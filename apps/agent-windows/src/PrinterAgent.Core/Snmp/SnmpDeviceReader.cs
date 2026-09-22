using System.Net;
using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Messaging;
using Microsoft.Extensions.Logging;
using PrinterAgent.Core.Models;

namespace PrinterAgent.Core.Snmp;

/// <summary>
/// Reads one host over SNMP v1/v2c (spec §16-17) and normalizes whatever it
/// finds into a <see cref="DiscoveredDevice"/>. A field the device doesn't
/// expose is left null — never guessed (spec §67). Returns null entirely
/// when the host doesn't answer SNMP at all (not a printer we can manage).
/// </summary>
public class SnmpDeviceReader
{
    private readonly ILogger<SnmpDeviceReader> _logger;

    public SnmpDeviceReader(ILogger<SnmpDeviceReader> logger)
    {
        _logger = logger;
    }

    public async Task<DiscoveredDevice?> ReadAsync(IPAddress ip, string community, int timeoutMs, int retries, CancellationToken ct)
    {
        // Most modern printers speak v2c, but plenty of older/cheaper ones
        // (and some consumer inkjets) only implement v1 — falling back
        // instead of giving up means those devices actually get discovered
        // rather than silently skipped.
        var device = await ReadWithVersionAsync(ip, community, VersionCode.V2, timeoutMs, retries, ct);
        device ??= await ReadWithVersionAsync(ip, community, VersionCode.V1, timeoutMs, retries, ct);
        return device;
    }

    private async Task<DiscoveredDevice?> ReadWithVersionAsync(
        IPAddress ip, string community, VersionCode version, int timeoutMs, int retries, CancellationToken ct)
    {
        var endpoint = new IPEndPoint(ip, 161);
        var communityOctet = new OctetString(community);

        var sysDescr = await TryGetAsync(endpoint, communityOctet, version, PrinterMibOids.SysDescr, timeoutMs, retries, ct);
        if (sysDescr is null)
        {
            // No SNMP response at all on this version — caller either
            // retries with another version or (if this was the last one)
            // treats the host as not something we can manage.
            return null;
        }

        var manufacturer = InferManufacturer(sysDescr);
        // Walked, not GET'd at a fixed ".1" — a multi-engine/multi-function
        // device may index its printer sub-unit at something other than 1,
        // and a fixed GET would just silently miss it there.
        var printerName = await WalkFirstNonEmptyAsync(endpoint, communityOctet, version, PrinterMibOids.PrtGeneralPrinterNameTable, timeoutMs, ct);
        var device = new DiscoveredDevice
        {
            Ip = ip.ToString(),
            SysDescr = sysDescr,
            Manufacturer = manufacturer,
            // Prefer the Printer-MIB's own human-readable product name when
            // the device implements it — sysDescr is often a long
            // ";"-delimited dump (model, firmware date, engine/NIC
            // versions, serial...) that's noisier and less reliable to
            // parse (spec §66: normalize what we send, don't just forward
            // the raw blob as-is).
            Model = !string.IsNullOrWhiteSpace(printerName) ? printerName : ExtractModel(sysDescr, manufacturer),
        };

        device.Hostname = await TryGetAsync(endpoint, communityOctet, version, PrinterMibOids.SysName, timeoutMs, retries, ct);
        device.Serial = await WalkFirstNonEmptyAsync(endpoint, communityOctet, version, PrinterMibOids.PrtGeneralSerialNumberTable, timeoutMs, ct);

        // ARP first (works even when SNMP read access is restricted to just
        // the Printer-MIB subtree, as many consumer/SMB devices do); the
        // IF-MIB walk only helps when the printer is on a different subnet
        // from this Agent, where ARP can't see it at all.
        device.Mac = ArpResolver.ResolveMac(ip) ?? await ReadMacAddressAsync(endpoint, communityOctet, version, timeoutMs, ct);

        device.Counters = await ReadCountersAsync(endpoint, communityOctet, version, timeoutMs, retries, ct);

        device.Consumables = await ReadSuppliesAsync(endpoint, communityOctet, version, timeoutMs, ct);

        device.SupportsA3 = await DetectSupportsA3Async(endpoint, communityOctet, version, timeoutMs, ct);

        return device;
    }

    /// <summary>
    /// Walks the Printer-MIB marker table to split the life count into
    /// black &amp; white vs. color, using prtMarkerProcessColorants (RFC 3805)
    /// to classify each marker — a marker whose colorants are just "black"
    /// (or equivalent single-colorant mono description) counts toward
    /// BlackWhite, anything with more than one colorant counts toward
    /// Color. Devices with a single marker (the common case) get Total
    /// only, same as before. "Copies" (walk-up copier usage, as opposed to
    /// driver-submitted prints) and duplex sheet counts have no standard
    /// Printer-MIB OID — they're vendor-specific and not read here.
    /// </summary>
    private async Task<DeviceCounters?> ReadCountersAsync(IPEndPoint endpoint, OctetString community, VersionCode version, int timeoutMs, int retries, CancellationToken ct)
    {
        var lifeCounts = await WalkAsync(endpoint, community, version, PrinterMibOids.PrtMarkerLifeCountTable, timeoutMs, ct);
        if (lifeCounts.Count == 0)
        {
            // Table walk unsupported/empty — fall back to the single total OID some devices only expose directly.
            var fallbackTotal = await TryGetIntAsync(endpoint, community, version, PrinterMibOids.PrtMarkerLifeCountTotal, timeoutMs, retries, ct);
            return fallbackTotal is null ? null : new DeviceCounters { Total = fallbackTotal };
        }

        var colorants = await WalkAsync(endpoint, community, version, PrinterMibOids.PrtMarkerProcessColorantsTable, timeoutMs, ct);

        int? total = null, blackWhite = null, color = null;
        foreach (var (oid, raw) in lifeCounts)
        {
            if (!int.TryParse(raw, out var count))
            {
                continue;
            }
            total = (total ?? 0) + count;

            var index = oid[(oid.LastIndexOf('.') + 1)..];
            var colorant = colorants.GetValueOrDefault($"{PrinterMibOids.PrtMarkerProcessColorantsTable}.{index}");
            if (colorant is null)
            {
                // No colorant info for this marker — can't classify it, only Total reflects it.
                continue;
            }

            var isMono = !new[] { "cyan", "magenta", "yellow" }.Any(c => colorant.Contains(c, StringComparison.OrdinalIgnoreCase));
            if (isMono)
            {
                blackWhite = (blackWhite ?? 0) + count;
            }
            else
            {
                color = (color ?? 0) + count;
            }
        }

        return new DeviceCounters { Total = total, BlackWhite = blackWhite, Color = color };
    }

    private async Task<List<DeviceConsumable>?> ReadSuppliesAsync(IPEndPoint endpoint, OctetString community, VersionCode version, int timeoutMs, CancellationToken ct)
    {
        try
        {
            var descriptions = await WalkAsync(endpoint, community, version, PrinterMibOids.PrtMarkerSuppliesDescriptionTable, timeoutMs, ct);
            if (descriptions.Count == 0)
            {
                return null;
            }

            var levels = await WalkAsync(endpoint, community, version, PrinterMibOids.PrtMarkerSuppliesLevelTable, timeoutMs, ct);
            var capacities = await WalkAsync(endpoint, community, version, PrinterMibOids.PrtMarkerSuppliesMaxCapacityTable, timeoutMs, ct);

            var result = new List<DeviceConsumable>();
            foreach (var (oid, description) in descriptions)
            {
                var index = oid[(oid.LastIndexOf('.') + 1)..];
                var name = description.Trim();
                if (name.Length == 0)
                {
                    continue;
                }

                var color = PrinterMibOids.SupplyColorKeywords
                    .FirstOrDefault(k => name.Contains(k.Keyword, StringComparison.OrdinalIgnoreCase))
                    .Color;

                double? levelPercent = null;
                if (levels.TryGetValue($"{PrinterMibOids.PrtMarkerSuppliesLevelTable}.{index}", out var levelRaw) &&
                    capacities.TryGetValue($"{PrinterMibOids.PrtMarkerSuppliesMaxCapacityTable}.{index}", out var capacityRaw) &&
                    int.TryParse(levelRaw, out var level) && int.TryParse(capacityRaw, out var capacity) && capacity > 0 && level >= 0)
                {
                    // Printer-MIB uses -2 for "unknown level" and -1 for "unlimited" — never report those as a percentage.
                    levelPercent = Math.Round(level * 100.0 / capacity, 1);
                }

                result.Add(new DeviceConsumable
                {
                    Type = "toner",
                    Color = color,
                    Name = name,
                    LevelPercent = levelPercent,
                    Capacity = capacities.GetValueOrDefault($"{PrinterMibOids.PrtMarkerSuppliesMaxCapacityTable}.{index}"),
                });
            }

            return result.Count > 0 ? result : null;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Supplies table not available for {Endpoint}", endpoint);
            return null;
        }
    }

    /// <summary>
    /// Detects whether this device has at least one input tray physically
    /// large enough for A3 media (297×420mm), purely from Printer-MIB's own
    /// declared tray dimensions (RFC 3805 prtInputEntry — never inferred
    /// from the model name or guessed, spec §67). Returns null when the
    /// device doesn't expose the input table at all (genuinely unknown —
    /// distinct from "checked and it's smaller than A3").
    /// </summary>
    private async Task<bool?> DetectSupportsA3Async(IPEndPoint endpoint, OctetString community, VersionCode version, int timeoutMs, CancellationToken ct)
    {
        var units = await WalkAsync(endpoint, community, version, PrinterMibOids.PrtInputDimUnitTable, timeoutMs, ct);
        if (units.Count == 0)
        {
            return null;
        }
        var feedDims = await WalkAsync(endpoint, community, version, PrinterMibOids.PrtInputMediaDimFeedDirTable, timeoutMs, ct);
        var xFeedDims = await WalkAsync(endpoint, community, version, PrinterMibOids.PrtInputMediaDimXFeedDirTable, timeoutMs, ct);

        var anyTrayDetermined = false;
        foreach (var (oid, unitRaw) in units)
        {
            var index = oid[(oid.LastIndexOf('.') + 1)..];
            if (!int.TryParse(unitRaw, out var unit))
            {
                continue;
            }
            if (!feedDims.TryGetValue($"{PrinterMibOids.PrtInputMediaDimFeedDirTable}.{index}", out var feedRaw) ||
                !xFeedDims.TryGetValue($"{PrinterMibOids.PrtInputMediaDimXFeedDirTable}.{index}", out var xFeedRaw))
            {
                continue;
            }
            // -1 ("no restriction") and -2 ("unknown") are RFC 3805
            // sentinels, not real measurements — a tray reporting either
            // stays inconclusive rather than being treated as "fits A3".
            if (!int.TryParse(feedRaw, out var feed) || !int.TryParse(xFeedRaw, out var xFeed) || feed <= 0 || xFeed <= 0)
            {
                continue;
            }

            var feedMm = ToMillimeters(feed, unit);
            var xFeedMm = ToMillimeters(xFeed, unit);
            if (feedMm is null || xFeedMm is null)
            {
                continue;
            }

            anyTrayDetermined = true;
            var longSide = Math.Max(feedMm.Value, xFeedMm.Value);
            var shortSide = Math.Min(feedMm.Value, xFeedMm.Value);
            // A3 = 297×420mm — a few mm of tolerance for rounding, without
            // drifting into adjacent formats like Legal (216×356mm) or
            // Tabloid/Ledger (279×432mm), which shouldn't count as A3.
            if (longSide >= 410 && shortSide >= 285)
            {
                return true;
            }
        }

        return anyTrayDetermined ? false : null;
    }

    private static double? ToMillimeters(int value, int unit) => unit switch
    {
        PrinterMibOids.MediaUnitMicrometers => value / 1000.0,
        PrinterMibOids.MediaUnitTenThousandthsOfInch => value / 10000.0 * 25.4,
        _ => null,
    };

    /// <summary>Walks a Printer-MIB general-table column and returns the first non-empty value found (any index, not assumed to be ".1").</summary>
    private async Task<string?> WalkFirstNonEmptyAsync(IPEndPoint endpoint, OctetString community, VersionCode version, string rootOid, int timeoutMs, CancellationToken ct)
    {
        var values = await WalkAsync(endpoint, community, version, rootOid, timeoutMs, ct);
        return values.Values.Select(v => v.Trim()).FirstOrDefault(v => v.Length > 0);
    }

    /// <summary>
    /// Printer-MIB has no MAC OID of its own — IF-MIB's ifPhysAddress table
    /// (walked, one row per network interface) is the standard place to
    /// find it. Printers almost always expose a single real interface, so
    /// the first non-empty, non-zero physical address found is it.
    /// </summary>
    private async Task<string?> ReadMacAddressAsync(IPEndPoint endpoint, OctetString community, VersionCode version, int timeoutMs, CancellationToken ct)
    {
        var received = await WalkRawAsync(endpoint, community, version, PrinterMibOids.IfPhysAddressTable, timeoutMs, ct);
        foreach (var variable in received)
        {
            if (variable.Data is not OctetString octet)
            {
                continue;
            }
            var bytes = octet.ToBytes();
            if (bytes.Length == 6 && bytes.Any(b => b != 0))
            {
                return string.Join(":", bytes.Select(b => b.ToString("X2")));
            }
        }
        return null;
    }

    private async Task<Dictionary<string, string>> WalkAsync(IPEndPoint endpoint, OctetString community, VersionCode version, string rootOid, int timeoutMs, CancellationToken ct)
    {
        var received = await WalkRawAsync(endpoint, community, version, rootOid, timeoutMs, ct);
        var results = new Dictionary<string, string>();
        foreach (var variable in received)
        {
            results[variable.Id.ToString()] = variable.Data.ToString() ?? string.Empty;
        }
        return results;
    }

    private static async Task<List<Variable>> WalkRawAsync(IPEndPoint endpoint, OctetString community, VersionCode version, string rootOid, int timeoutMs, CancellationToken ct)
    {
        var received = new List<Variable>();
        await Task.Run(() =>
        {
            try
            {
                Messenger.Walk(version, endpoint, community, new ObjectIdentifier(rootOid), received, timeoutMs, WalkMode.WithinSubtree);
            }
            catch (Lextm.SharpSnmpLib.Messaging.TimeoutException)
            {
                // Expected for devices without this table — return whatever we collected before timing out.
            }
        }, ct);
        return received;
    }

    private async Task<string?> TryGetAsync(IPEndPoint endpoint, OctetString community, VersionCode version, string oid, int timeoutMs, int retries, CancellationToken ct)
    {
        for (var attempt = 0; attempt <= retries; attempt++)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var variables = new List<Variable> { new(new ObjectIdentifier(oid)) };
                var result = await Task.Run(
                    () => Messenger.Get(version, endpoint, community, variables, timeoutMs), ct);
                var data = result.FirstOrDefault()?.Data;

                // SNMP's own "this OID doesn't exist on this device" markers —
                // e.g. a firewall/switch answering sysDescr but having no
                // Printer-MIB serial number OID at all. Must be treated as
                // "not available" (null), never stored as a literal string
                // (spec §67 — never invent/misrepresent a value).
                if (data is null or NoSuchObject or NoSuchInstance or EndOfMibView)
                {
                    return null;
                }

                var value = data.ToString()?.Trim();
                return string.IsNullOrEmpty(value) ? null : value;
            }
            catch (Lextm.SharpSnmpLib.Messaging.TimeoutException)
            {
                // try again if attempts remain, otherwise fall through to null
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "SNMP GET {Oid} failed for {Endpoint}", oid, endpoint);
                return null;
            }
        }
        return null;
    }

    private async Task<int?> TryGetIntAsync(IPEndPoint endpoint, OctetString community, VersionCode version, string oid, int timeoutMs, int retries, CancellationToken ct)
    {
        var raw = await TryGetAsync(endpoint, community, version, oid, timeoutMs, retries, ct);
        return int.TryParse(raw, out var value) ? value : null;
    }

    private static string? InferManufacturer(string sysDescr) =>
        PrinterMibOids.KnownManufacturers.FirstOrDefault(m => sysDescr.Contains(m, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Best-effort "model" out of a raw sysDescr: take the first ";"-delimited
    /// segment (many vendors format sysDescr as "Model; firmware; engine;
    /// NIC; serial..."), then strip a leading manufacturer name so the UI
    /// doesn't show "Samsung Samsung SL-M4070FR". Falls back to the full
    /// string if that leaves nothing usable — never returns an empty model
    /// when the device actually reported something (spec §67). Only used
    /// when the device doesn't implement prtGeneralPrinterName.
    /// </summary>
    private static string ExtractModel(string sysDescr, string? manufacturer)
    {
        var firstSegment = sysDescr.Split(';')[0].Trim();

        if (manufacturer is not null && firstSegment.StartsWith(manufacturer, StringComparison.OrdinalIgnoreCase))
        {
            firstSegment = firstSegment[manufacturer.Length..].Trim();
        }

        return firstSegment.Length > 0 ? firstSegment : sysDescr;
    }
}
