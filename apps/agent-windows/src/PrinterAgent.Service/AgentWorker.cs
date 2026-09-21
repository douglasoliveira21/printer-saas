using Microsoft.Extensions.Options;
using PrinterAgent.Core.Api;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Discovery;
using PrinterAgent.Core.Models;
using PrinterAgent.Core.Queue;

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
    private readonly IOptionsMonitor<AgentOptions> _options;
    private readonly ILogger<AgentWorker> _logger;

    private DateTime _lastDiscovery = DateTime.MinValue;
    private DateTime _lastCollection = DateTime.MinValue;

    public AgentWorker(
        AgentEnrollmentService enrollment,
        PrinterSaasApiClient apiClient,
        PrinterDiscoveryService discovery,
        OfflineQueue offlineQueue,
        IOptionsMonitor<AgentOptions> options,
        ILogger<AgentWorker> logger)
    {
        _enrollment = enrollment;
        _apiClient = apiClient;
        _discovery = discovery;
        _offlineQueue = offlineQueue;
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
                    await RunDiscoveryAndCollectionAsync(options, stoppingToken);
                }
                else if (now - _lastCollection >= TimeSpan.FromSeconds(options.CollectionIntervalSeconds))
                {
                    // Re-collect from already-known devices without a full
                    // network sweep — cheaper, runs far more often than discovery.
                    _lastCollection = now;
                    await RunDiscoveryAndCollectionAsync(options, stoppingToken);
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
    }

    private async Task RunDiscoveryAndCollectionAsync(AgentOptions options, CancellationToken ct)
    {
        var devices = await _discovery.ScanAsync(options, ct);
        if (devices.Count == 0)
        {
            return;
        }

        var batch = new SubmitDevicesRequest { Devices = devices };
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
            await _offlineQueue.RequeueAsync(stillPending);
        }
    }
}
