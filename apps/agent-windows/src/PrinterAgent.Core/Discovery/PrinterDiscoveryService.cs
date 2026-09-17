using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Models;
using PrinterAgent.Core.Snmp;

namespace PrinterAgent.Core.Discovery;

/// <summary>
/// Sweeps the configured networks and probes each host over SNMP (spec
/// §15). Bounded concurrency so this never turns into an aggressive scan
/// (spec §15's own explicit requirement) — <see cref="AgentOptions.DiscoveryConcurrency"/>
/// caps how many hosts are probed at once.
/// </summary>
public class PrinterDiscoveryService
{
    private readonly SnmpDeviceReader _snmpReader;
    private readonly ILogger<PrinterDiscoveryService> _logger;

    public PrinterDiscoveryService(SnmpDeviceReader snmpReader, ILogger<PrinterDiscoveryService> logger)
    {
        _snmpReader = snmpReader;
        _logger = logger;
    }

    public async Task<List<DiscoveredDevice>> ScanAsync(AgentOptions options, CancellationToken ct)
    {
        if (options.Networks.Count == 0)
        {
            _logger.LogInformation("No discovery networks configured yet — skipping scan");
            return [];
        }

        var targets = options.Networks.SelectMany(NetworkRange.Expand).Distinct().ToList();
        _logger.LogInformation("Scanning {Count} hosts across {Networks} network target(s)", targets.Count, options.Networks.Count);

        var channel = Channel.CreateUnbounded<DiscoveredDevice>();
        using var throttle = new SemaphoreSlim(options.DiscoveryConcurrency);

        var probes = targets.Select(async ip =>
        {
            await throttle.WaitAsync(ct);
            try
            {
                var device = await _snmpReader.ReadAsync(ip, options.SnmpCommunity, options.SnmpTimeoutMs, options.SnmpRetries, ct);
                if (device is not null)
                {
                    await channel.Writer.WriteAsync(device, ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Probe failed for {Ip}", ip);
            }
            finally
            {
                throttle.Release();
            }
        });

        _ = Task.WhenAll(probes).ContinueWith(_ => channel.Writer.Complete(), ct);

        var found = new List<DiscoveredDevice>();
        await foreach (var device in channel.Reader.ReadAllAsync(ct))
        {
            found.Add(device);
        }

        _logger.LogInformation("Discovery complete: {Found} SNMP-responsive device(s) found", found.Count);
        return found;
    }
}
