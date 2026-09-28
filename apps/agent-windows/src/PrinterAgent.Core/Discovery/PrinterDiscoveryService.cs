using System.Net;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Discovery.Dns;
using PrinterAgent.Core.Models;

namespace PrinterAgent.Core.Discovery;

/// <summary>
/// Probes hosts with every available protocol via
/// <see cref="DeviceProbeOrchestrator"/> (spec §15). Two entry points, both
/// sharing the same per-host probing/concurrency/telemetry machinery
/// (Fase 10 — separar Discovery de Collection):
/// <see cref="ScanAsync"/> sweeps the CONFIGURED NETWORKS (every IP in the
/// range — "quem existe?"), and <see cref="CollectAsync"/> re-probes an
/// explicit, already-known list of printer IPs ("atualizar o que já
/// conheço") without expanding/validating any network range at all. Bounded
/// concurrency so this never turns into an aggressive scan (spec §15's own
/// explicit requirement) — <see cref="AgentOptions.DiscoveryConcurrency"/>
/// caps how many hosts are probed at once, in either mode.
/// </summary>
public class PrinterDiscoveryService
{
    private readonly DeviceProbeOrchestrator _orchestrator;
    private readonly MdnsProbe _mdnsProbe;
    private readonly WsDiscoveryProbe _wsDiscoveryProbe;
    private readonly ILogger<PrinterDiscoveryService> _logger;

    public PrinterDiscoveryService(DeviceProbeOrchestrator orchestrator, MdnsProbe mdnsProbe, WsDiscoveryProbe wsDiscoveryProbe, ILogger<PrinterDiscoveryService> logger)
    {
        _orchestrator = orchestrator;
        _mdnsProbe = mdnsProbe;
        _wsDiscoveryProbe = wsDiscoveryProbe;
        _logger = logger;
    }

    /// <param name="progress">
    /// Reports (hosts probed so far, total hosts) as the sweep runs — each
    /// host can take a few seconds now that it's probed over several
    /// protocols (SNMP+IPP+TCP ports), so a caller showing this is what
    /// tells the operator the scan is actually moving, not frozen.
    /// </param>
    public async Task<List<DiscoveredDevice>> ScanAsync(AgentOptions options, CancellationToken ct, IProgress<(int Done, int Total)>? progress = null)
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

        // Fase 7 (validação de Network Range) — computed arithmetically
        // (EstimateHostCount never enumerates), so this check is cheap even
        // for a target that would otherwise expand to millions of hosts.
        // Checked BEFORE the SelectMany/ToList below, which is what would
        // actually pay the cost of materializing an absurd range. Throwing
        // (not silently skipping) means both callers' existing exception
        // handling surfaces this clearly: AgentWorker's outer catch logs it
        // every cycle until fixed, and the ConfigTool's "Buscar agora"
        // button shows the message directly in its status text — no
        // silent multi-hour scan either way.
        var estimatedHosts = networks.Sum(NetworkRange.EstimateHostCount);
        if (estimatedHosts > options.MaximumDiscoveryHosts)
        {
            throw new InvalidOperationException(
                $"Discovery aborted: configured network(s) ({string.Join(", ", networks)}) would scan ~{estimatedHosts} hosts, " +
                $"above the configured limit of {options.MaximumDiscoveryHosts} (AgentOptions.MaximumDiscoveryHosts). " +
                "Narrow the configured ranges, or raise the limit if this is intentional.");
        }

        var targets = networks.SelectMany(NetworkRange.Expand).Distinct().ToList();
        _logger.LogInformation("Scanning {Count} hosts across {Networks} network target(s)", targets.Count, networks.Count);

        return await ProbeTargetsAsync(targets, "Discovery", options, ct, progress);
    }

    /// <summary>
    /// Fase 10 (separar Discovery de Collection) — re-probes only the IPs
    /// the caller already knows about (the SaaS's own printer inventory for
    /// this Agent, via GET /agent-api/v1/printers — see
    /// AgentWorker.CollectKnownPrintersAsync), instead of expanding and
    /// sweeping the entire configured network range. This is what makes a
    /// network with 1000 hosts / 20 real printers stop paying for 1000
    /// probes every 15 minutes just to refresh those 20 — full discovery
    /// (<see cref="ScanAsync"/>) still runs on its own, longer interval to
    /// catch anything genuinely new. No network-range validation here
    /// (Fase 7) — the caller already has a concrete, bounded IP list, there
    /// is nothing to expand or estimate.
    /// </summary>
    public Task<List<DiscoveredDevice>> CollectAsync(
        IReadOnlyList<IPAddress> knownPrinterIps, AgentOptions options, CancellationToken ct, IProgress<(int Done, int Total)>? progress = null)
    {
        if (knownPrinterIps.Count == 0)
        {
            _logger.LogDebug("Collection skipped — no known printer IPs to re-probe yet");
            return Task.FromResult(new List<DiscoveredDevice>());
        }

        return ProbeTargetsAsync(knownPrinterIps, "Collection", options, ct, progress);
    }

    private async Task<List<DiscoveredDevice>> ProbeTargetsAsync(
        IReadOnlyList<IPAddress> targets, string mode, AgentOptions options, CancellationToken ct, IProgress<(int Done, int Total)>? progress)
    {
        // mDNS and WS-Discovery are both multicast — one query each for the
        // whole sweep, not one per host, unlike every other protocol here.
        // Run concurrently (independent sockets/protocols) rather than one
        // after another, so this doesn't just add 1200ms to every cycle.
        var mdnsTask = _mdnsProbe.DiscoverAsync(listenMs: 1200, ct);
        var wsDiscoveryTask = _wsDiscoveryProbe.DiscoverAsync(listenMs: 1200, ct);
        await Task.WhenAll(mdnsTask, wsDiscoveryTask);
        var mdnsResults = mdnsTask.Result;
        var wsDiscoveryResults = wsDiscoveryTask.Result;

        var channel = Channel.CreateUnbounded<DiscoveredDevice>();
        using var throttle = new SemaphoreSlim(options.DiscoveryConcurrency);
        var probed = 0;
        progress?.Report((0, targets.Count));

        // A per-host hard ceiling on top of every individual probe's own
        // timeout — belt and suspenders (spec §18: "um equipamento que não
        // responde não pode travar o discovery inteiro"). Each host holds
        // one of the limited DiscoveryConcurrency slots; if a probe ever
        // hangs for an unforeseen reason (a bug, an unusual device response,
        // a platform quirk), this guarantees the slot is freed anyway
        // instead of quietly reducing effective concurrency scan after scan.
        var hostTimeoutMs = Math.Max(5000, options.SnmpTimeoutMs * 4);

        // Fase 8 (telemetria) — plain ints updated via Interlocked, same
        // pattern as `probed` above; every host probed contributes exactly
        // once to each counter it applies to, regardless of concurrency.
        var metrics = new DiscoveryMetrics();
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        var probes = targets.Select(async ip =>
        {
            await throttle.WaitAsync(ct);
            try
            {
                using var hostCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                hostCts.CancelAfter(hostTimeoutMs);
                var outcome = await _orchestrator.ProbeAsync(
                    ip, options.SnmpCommunity, options.SnmpTimeoutMs, options.SnmpRetries,
                    auxTimeoutMs: Math.Max(1000, options.SnmpTimeoutMs), mdnsResults, wsDiscoveryResults, hostCts.Token);

                if (outcome.SnmpResponded) Interlocked.Increment(ref metrics.SnmpSuccess); else Interlocked.Increment(ref metrics.SnmpFailure);
                if (outcome.IppResponded) Interlocked.Increment(ref metrics.IppSuccess); else Interlocked.Increment(ref metrics.IppFailure);
                if (outcome.Classified) Interlocked.Increment(ref metrics.DevicesClassified);

                if (outcome.Device is not null)
                {
                    await channel.Writer.WriteAsync(outcome.Device, ct);
                }
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                Interlocked.Increment(ref metrics.Timeouts);
                _logger.LogDebug("Probe for {Ip} exceeded the {TimeoutMs}ms per-host ceiling — skipped", ip, hostTimeoutMs);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Probe failed for {Ip}", ip);
            }
            finally
            {
                var done = Interlocked.Increment(ref probed);
                progress?.Report((done, targets.Count));
                throttle.Release();
            }
        });

        _ = Task.WhenAll(probes).ContinueWith(_ => channel.Writer.Complete(), ct);

        var found = new List<DiscoveredDevice>();
        await foreach (var device in channel.Reader.ReadAllAsync(ct))
        {
            found.Add(device);
        }

        stopwatch.Stop();
        // One structured line per cycle (Information level — always on,
        // spec: answer "por que essa impressora não apareceu?" / "por que
        // o Agent parou de coletar?" without needing Debug logging turned
        // on). snmp_failure/ipp_failure include every host that simply
        // didn't answer that protocol (most hosts, most of the time) — high
        // absolute numbers here are normal; what matters for diagnosis is
        // whether they're near 100% (protocol likely blocked network-wide)
        // vs. proportional to how many hosts actually have that service.
        _logger.LogInformation(
            "{Mode} complete: scan_duration={ScanDurationMs}ms hosts_examined={HostsExamined} devices_found={DevicesFound} " +
            "devices_classified={DevicesClassified} snmp_success={SnmpSuccess} snmp_failure={SnmpFailure} " +
            "ipp_success={IppSuccess} ipp_failure={IppFailure} timeouts={Timeouts}",
            mode, stopwatch.ElapsedMilliseconds, targets.Count, found.Count, metrics.DevicesClassified,
            metrics.SnmpSuccess, metrics.SnmpFailure, metrics.IppSuccess, metrics.IppFailure, metrics.Timeouts);
        return found;
    }

    /// <summary>Fase 8 (telemetria) — plain mutable counters, all updated via Interlocked from concurrent probe tasks.</summary>
    private class DiscoveryMetrics
    {
        public int SnmpSuccess;
        public int SnmpFailure;
        public int IppSuccess;
        public int IppFailure;
        public int DevicesClassified;
        public int Timeouts;
    }
}
