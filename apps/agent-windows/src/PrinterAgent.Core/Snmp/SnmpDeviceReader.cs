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
        var endpoint = new IPEndPoint(ip, 161);
        var communityOctet = new OctetString(community);

        var sysDescr = await TryGetAsync(endpoint, communityOctet, PrinterMibOids.SysDescr, timeoutMs, retries, ct);
        if (sysDescr is null)
        {
            // No SNMP response at all — not something we can manage; the
            // caller (PrinterDiscoveryService) simply skips this host.
            return null;
        }

        var manufacturer = InferManufacturer(sysDescr);
        var device = new DiscoveredDevice
        {
            Ip = ip.ToString(),
            SysDescr = sysDescr,
            Manufacturer = manufacturer,
            // sysDescr is often a long ";"-delimited dump (model, firmware
            // date, engine/NIC versions, serial...) — the raw string stays
            // available in SysDescr for anyone who needs it, but as a
            // "model" it just duplicates the manufacturer and buries the
            // actually useful part behind noise (spec §66: normalize what
            // we send, don't just forward the raw blob as-is).
            Model = ExtractModel(sysDescr, manufacturer),
        };

        device.Hostname = await TryGetAsync(endpoint, communityOctet, PrinterMibOids.SysName, timeoutMs, retries, ct);
        device.Serial = await TryGetAsync(endpoint, communityOctet, PrinterMibOids.PrtGeneralSerialNumber, timeoutMs, retries, ct);

        device.Counters = await ReadCountersAsync(endpoint, communityOctet, timeoutMs, retries, ct);

        device.Consumables = await ReadSuppliesAsync(endpoint, communityOctet, timeoutMs, retries, ct);

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
    private async Task<DeviceCounters?> ReadCountersAsync(IPEndPoint endpoint, OctetString community, int timeoutMs, int retries, CancellationToken ct)
    {
        var lifeCounts = await WalkAsync(endpoint, community, PrinterMibOids.PrtMarkerLifeCountTable, timeoutMs, ct);
        if (lifeCounts.Count == 0)
        {
            // Table walk unsupported/empty — fall back to the single total OID some devices only expose directly.
            var fallbackTotal = await TryGetIntAsync(endpoint, community, PrinterMibOids.PrtMarkerLifeCountTotal, timeoutMs, retries, ct);
            return fallbackTotal is null ? null : new DeviceCounters { Total = fallbackTotal };
        }

        var colorants = await WalkAsync(endpoint, community, PrinterMibOids.PrtMarkerProcessColorantsTable, timeoutMs, ct);

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

    private async Task<List<DeviceConsumable>?> ReadSuppliesAsync(IPEndPoint endpoint, OctetString community, int timeoutMs, int retries, CancellationToken ct)
    {
        try
        {
            var descriptions = await WalkAsync(endpoint, community, PrinterMibOids.PrtMarkerSuppliesDescriptionTable, timeoutMs, ct);
            if (descriptions.Count == 0)
            {
                return null;
            }

            var levels = await WalkAsync(endpoint, community, PrinterMibOids.PrtMarkerSuppliesLevelTable, timeoutMs, ct);
            var capacities = await WalkAsync(endpoint, community, PrinterMibOids.PrtMarkerSuppliesMaxCapacityTable, timeoutMs, ct);

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

    private async Task<Dictionary<string, string>> WalkAsync(IPEndPoint endpoint, OctetString community, string rootOid, int timeoutMs, CancellationToken ct)
    {
        var results = new Dictionary<string, string>();
        var received = new List<Variable>();
        await Task.Run(() =>
        {
            try
            {
                Messenger.Walk(VersionCode.V2, endpoint, community, new ObjectIdentifier(rootOid), received, timeoutMs, WalkMode.WithinSubtree);
            }
            catch (Lextm.SharpSnmpLib.Messaging.TimeoutException)
            {
                // Expected for devices without this table — return whatever we collected before timing out.
            }
        }, ct);

        foreach (var variable in received)
        {
            results[variable.Id.ToString()] = variable.Data.ToString() ?? string.Empty;
        }
        return results;
    }

    private async Task<string?> TryGetAsync(IPEndPoint endpoint, OctetString community, string oid, int timeoutMs, int retries, CancellationToken ct)
    {
        for (var attempt = 0; attempt <= retries; attempt++)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var variables = new List<Variable> { new(new ObjectIdentifier(oid)) };
                var result = await Task.Run(
                    () => Messenger.Get(VersionCode.V2, endpoint, community, variables, timeoutMs), ct);
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

    private async Task<int?> TryGetIntAsync(IPEndPoint endpoint, OctetString community, string oid, int timeoutMs, int retries, CancellationToken ct)
    {
        var raw = await TryGetAsync(endpoint, community, oid, timeoutMs, retries, ct);
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
    /// when the device actually reported something (spec §67).
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
