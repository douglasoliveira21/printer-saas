using System.Net;
using Microsoft.Extensions.Options;
using PrinterAgent.Core.Api;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Discovery;
using PrinterAgent.Core.Models;
using PrinterAgent.Core.Queue;
using PrinterAgent.Core.Snmp;
using PrinterAgent.Core.Update;

namespace PrinterAgent.Service;

/// <summary>
/// Top-level loop: enroll once, then heartbeat / discover+collect / flush
/// the offline queue on their own independent intervals (spec §14-15,
/// §39). Deliberately has zero business logic beyond "collect and send" —
/// spec §65: interpretation, alerting and billing all live in the backend.
/// </summary>
public class AgentWorker : BackgroundService
{
    private readonly AgentEnrollmentService _enrollment;
    private readonly PrinterSaasApiClient _apiClient;
    private readonly PrinterDiscoveryService _discovery;
    private readonly OfflineQueue _offlineQueue;
    private readonly SnmpV3CredentialStore _snmpV3CredentialStore;
    private readonly AgentUpdateChecker _updateChecker;
    private readonly IOptionsMonitor<AgentOptions> _options;
    private readonly ILogger<AgentWorker> _logger;

    private DateTime _lastDiscovery = DateTime.MinValue;
    private DateTime _lastCollection = DateTime.MinValue;
    private DateTime _lastUpdateCheck = DateTime.MinValue;

    public AgentWorker(
        AgentEnrollmentService enrollment,
        PrinterSaasApiClient apiClient,
        PrinterDiscoveryService discovery,
        OfflineQueue offlineQueue,
        SnmpV3CredentialStore snmpV3CredentialStore,
        AgentUpdateChecker updateChecker,
        IOptionsMonitor<AgentOptions> options,
        ILogger<AgentWorker> logger)
    {
        _enrollment = enrollment;
        _apiClient = apiClient;
        _discovery = discovery;
        _offlineQueue = offlineQueue;
        _snmpV3CredentialStore = snmpV3CredentialStore;
        _updateChecker = updateChecker;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _enrollment.EnsureEnrolledAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var options = _options.CurrentValue;
            try
            {
                await SendHeartbeatAsync(stoppingToken);
                await RefreshRemoteConfigAsync(options, stoppingToken);
                await FlushOfflineQueueAsync(stoppingToken);

                var now = DateTime.UtcNow;
                if (options.DiscoveryEnabled && now - _lastDiscovery >= TimeSpan.FromSeconds(options.DiscoveryIntervalSeconds))
                {
                    _lastDiscovery = now;
                    _logger.LogDebug("Starting full discovery cycle");
                    await RunDiscoveryAsync(options, stoppingToken);
                }
                else if (now - _lastCollection >= TimeSpan.FromSeconds(options.CollectionIntervalSeconds))
                {
                    // Fase 10 (separar Discovery de Collection) — re-probes
                    // only the printers the SaaS already knows about for
                    // this Agent, not the whole configured network range.
                    // Full discovery (above) is what catches anything
                    // genuinely new, on its own longer interval.
                    _lastCollection = now;
                    _logger.LogDebug("Starting collection-only cycle");
                    await RunCollectionOnlyAsync(options, stoppingToken);
                }

                // Checked last, after everything else in this cycle has
                // already run — if an update is applied, PrinterAgentUpdater
                // stops this service shortly after this call returns, so
                // there's nothing useful left to do in the current loop
                // iteration anyway.
                if (options.UpdateCheckIntervalHours > 0 && now - _lastUpdateCheck >= TimeSpan.FromHours(options.UpdateCheckIntervalHours))
                {
                    _lastUpdateCheck = now;
                    await _updateChecker.CheckAndApplyAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error in agent loop — will retry next cycle");
            }

            await Task.Delay(TimeSpan.FromSeconds(options.HeartbeatIntervalSeconds), stoppingToken);
        }
    }

    private async Task SendHeartbeatAsync(CancellationToken ct)
    {
        var request = new HeartbeatRequest
        {
            Hostname = Environment.MachineName,
            OsVersion = Environment.OSVersion.VersionString,
            LocalIp = LocalNetwork.GetPrimaryIPv4Address(),
            AgentVersion = AgentVersion.Current,
        };
        var ok = await _apiClient.HeartbeatAsync(request, ct);
        _logger.LogDebug("Heartbeat {Result}", ok ? "sent" : "failed");
    }

    private async Task RefreshRemoteConfigAsync(AgentOptions options, CancellationToken ct)
    {
        var remote = await _apiClient.GetConfigAsync(ct);
        if (remote?.DiscoveryConfig?.Networks is { Count: > 0 } networks)
        {
            options.Networks = networks;
        }
        if (!string.IsNullOrWhiteSpace(remote?.DiscoveryConfig?.SnmpCommunity))
        {
            options.SnmpCommunity = remote!.DiscoveryConfig!.SnmpCommunity!;
        }
        // Per-printer/tenant-default SNMP v3 credentials, live-updated on
        // every poll so a credential created/changed/removed in the web app
        // reaches the running Agent without a service restart.
        _snmpV3CredentialStore.UpdateFromRemote(remote?.SnmpV3);
    }

    private async Task RunDiscoveryAsync(AgentOptions options, CancellationToken ct)
    {
        var devices = await _discovery.ScanAsync(options, ct);
        await SubmitDiscoveredDevicesAsync(devices, ct);
    }

    /// <summary>
    /// Fase 10 (separar Discovery de Collection) — fetches this Agent's own
    /// printer inventory from the SaaS (GET /agent-api/v1/printers — the
    /// same "Printer Inventory" the phase's own diagram describes) and only
    /// re-probes MONITORED printers with a real IP, instead of sweeping the
    /// configured network range again. A printer that's only DISCOVERED
    /// (never claimed) or IGNORED/DECOMMISSIONED is deliberately excluded —
    /// nobody is tracking it, re-probing it every cycle would be pure waste.
    /// If the API call itself fails (network/API down), this cycle is
    /// simply skipped — it does NOT fall back to a full network sweep,
    /// which would silently defeat the whole point of this fase and
    /// surprise an operator who scoped CollectionIntervalSeconds
    /// specifically to be cheap.
    /// </summary>
    private async Task RunCollectionOnlyAsync(AgentOptions options, CancellationToken ct)
    {
        var printers = await _apiClient.ListPrintersAsync(ct);
        var knownIps = printers
            .Where(p => p.Status == "MONITORED" && !string.IsNullOrWhiteSpace(p.Ip))
            .Select(p => IPAddress.TryParse(p.Ip, out var ip) ? ip : null)
            .Where(ip => ip is not null)
            .Select(ip => ip!)
            .Distinct()
            .ToList();

        var devices = await _discovery.CollectAsync(knownIps, options, ct);
        await SubmitDiscoveredDevicesAsync(devices, ct);
    }

    private async Task SubmitDiscoveredDevicesAsync(List<DiscoveredDevice> devices, CancellationToken ct)
    {
        if (devices.Count == 0)
        {
            return;
        }

        var batch = new SubmitDevicesRequest { Devices = devices, CollectionId = Guid.NewGuid().ToString() };
        var sent = await _apiClient.SubmitDevicesAsync(batch, ct);
        if (!sent)
        {
            await _offlineQueue.EnqueueAsync(batch);
        }
    }

    private async Task FlushOfflineQueueAsync(CancellationToken ct)
    {
        var pending = await _offlineQueue.DrainAsync();
        if (pending.Count == 0)
        {
            return;
        }

        _logger.LogInformation("Flushing {Count} queued batch(es)", pending.Count);
        var stillPending = new List<SubmitDevicesRequest>();
        foreach (var batch in pending)
        {
            if (!await _apiClient.SubmitDevicesAsync(batch, ct))
            {
                stillPending.Add(batch);
            }
        }

        if (stillPending.Count > 0)
        {
            // Fase 8 (telemetria) — this case was previously silent: the
            // batches went right back into the queue with no signal at all
            // that the flush attempt itself failed. This is the log line
            // that answers "por que o Agent desse cliente parou de
            // coletar?" when the real cause is a persistently unreachable
            // API, not the discovery side at all.
            _logger.LogWarning(
                "offline_queue_size={StillPending} — {Failed} of {Attempted} queued batch(es) still couldn't reach the API this cycle",
                stillPending.Count, stillPending.Count, pending.Count);
            await _offlineQueue.RequeueAsync(stillPending);
        }
    }
}
