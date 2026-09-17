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
        var networks = options.Networks;
        if (networks.Count == 0)
        {
            // Sensible default instead of doing nothing (spec §15 still
            // requires this to be overridable — GET /agent-api/v1/config or
            // the installer's "Redes para varredura" field always win over
            // this auto-detected fallback once set).
            networks = LocalNetwork.GetLocalIPv4Cidrs();
            if (networks.Count == 0)
            {
                _logger.LogInformation("No discovery networks configured and none could be auto-detected — skipping scan");
                return [];
            }
            _logger.LogInformation("No discovery networks configured — auto-detected local network(s): {Networks}", string.Join(", ", networks));
        }

        var targets = networks.SelectMany(NetworkRange.Expand).Distinct().ToList();
        _logger.LogInformation("Scanning {Count} hosts across {Networks} network target(s)", targets.Count, networks.Count);

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
