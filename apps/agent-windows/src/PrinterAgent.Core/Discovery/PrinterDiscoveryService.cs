using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Discovery.Dns;
using PrinterAgent.Core.Models;

namespace PrinterAgent.Core.Discovery;

/// <summary>
/// Sweeps the configured networks and probes each host with every available
/// protocol via <see cref="DeviceProbeOrchestrator"/> (spec §15). Bounded
/// concurrency so this never turns into an aggressive scan (spec §15's own
/// explicit requirement) — <see cref="AgentOptions.DiscoveryConcurrency"/>
/// caps how many hosts are probed at once.
/// </summary>
public class PrinterDiscoveryService
{
    private readonly DeviceProbeOrchestrator _orchestrator;
    private readonly MdnsProbe _mdnsProbe;
    private readonly ILogger<PrinterDiscoveryService> _logger;

    public PrinterDiscoveryService(DeviceProbeOrchestrator orchestrator, MdnsProbe mdnsProbe, ILogger<PrinterDiscoveryService> logger)
    {
        _orchestrator = orchestrator;
        _mdnsProbe = mdnsProbe;
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

        // mDNS is multicast — one query for the whole sweep, not one per
        // host, unlike every other protocol here.
        var mdnsResults = await _mdnsProbe.DiscoverAsync(listenMs: 1200, ct);

        var channel = Channel.CreateUnbounded<DiscoveredDevice>();
        using var throttle = new SemaphoreSlim(options.DiscoveryConcurrency);

        var probes = targets.Select(async ip =>
        {
            await throttle.WaitAsync(ct);
            try
            {
                var device = await _orchestrator.ProbeAsync(
                    ip, options.SnmpCommunity, options.SnmpTimeoutMs, options.SnmpRetries,
                    auxTimeoutMs: Math.Max(1000, options.SnmpTimeoutMs), mdnsResults, ct);
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

        _logger.LogInformation("Discovery complete: {Found} printer(s) found (classified from {TotalHosts} hosts probed)", found.Count, targets.Count);
        return found;
    }
}
