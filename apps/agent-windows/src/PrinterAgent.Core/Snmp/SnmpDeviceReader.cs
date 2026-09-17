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

        var device = new DiscoveredDevice
        {
            Ip = ip.ToString(),
            SysDescr = sysDescr,
            Manufacturer = InferManufacturer(sysDescr),
            Model = sysDescr,
        };

        device.Hostname = await TryGetAsync(endpoint, communityOctet, PrinterMibOids.SysName, timeoutMs, retries, ct);
        device.Serial = await TryGetAsync(endpoint, communityOctet, PrinterMibOids.PrtGeneralSerialNumber, timeoutMs, retries, ct);

        var totalPages = await TryGetIntAsync(endpoint, communityOctet, PrinterMibOids.PrtMarkerLifeCountTotal, timeoutMs, retries, ct);
        if (totalPages is not null)
        {
            device.Counters = new DeviceCounters { Total = totalPages };
        }

        device.Consumables = await ReadSuppliesAsync(endpoint, communityOctet, timeoutMs, retries, ct);

        return device;
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
                var value = result.FirstOrDefault()?.Data?.ToString()?.Trim();
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
}
