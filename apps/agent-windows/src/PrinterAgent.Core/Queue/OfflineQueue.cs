using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Models;

namespace PrinterAgent.Core.Queue;

/// <summary>
/// Offline-first local queue (spec §39): when the internet is down, device
/// batches pile up here instead of being lost, and get flushed as soon as
/// connectivity returns. Backed by a single JSON file — durable across
/// service restarts, deliberately not a database (nothing else on the
/// Agent needs one). Bounded by <see cref="AgentOptions.OfflineQueueMaxEntries"/>
/// so a long outage can't grow this file without limit.
/// </summary>
public class OfflineQueue
{
    private readonly string _path;
    private readonly AgentOptions _options;
    private readonly ILogger<OfflineQueue> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public OfflineQueue(IOptions<AgentOptions> options, ILogger<OfflineQueue> logger)
    {
        _options = options.Value;
        _logger = logger;
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "PrinterSaaS", "Agent");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "offline-queue.json");
    }

    public async Task EnqueueAsync(SubmitDevicesRequest batch)
    {
        await _lock.WaitAsync();
        try
        {
            var pending = await ReadAllAsync();
            pending.Add(batch);
            if (pending.Count > _options.OfflineQueueMaxEntries)
            {
                var overflow = pending.Count - _options.OfflineQueueMaxEntries;
                _logger.LogWarning("Offline queue full — dropping {Count} oldest batch(es)", overflow);
                pending = pending.Skip(overflow).ToList();
            }
            await WriteAllAsync(pending);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<List<SubmitDevicesRequest>> DrainAsync()
    {
        await _lock.WaitAsync();
        try
        {
            var pending = await ReadAllAsync();
            await WriteAllAsync([]);
            return pending;
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <summary>Puts unsent batches back at the front of the queue — used when a flush attempt fails partway through.</summary>
    public async Task RequeueAsync(IEnumerable<SubmitDevicesRequest> batches)
    {
        await _lock.WaitAsync();
        try
        {
            var pending = await ReadAllAsync();
            pending.InsertRange(0, batches);
            await WriteAllAsync(pending);
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<List<SubmitDevicesRequest>> ReadAllAsync()
    {
        if (!File.Exists(_path))
        {
            return [];
        }
        try
        {
            await using var stream = File.OpenRead(_path);
            return await JsonSerializer.DeserializeAsync<List<SubmitDevicesRequest>>(stream) ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Offline queue file is corrupt — starting fresh");
            return [];
        }
    }

    private async Task WriteAllAsync(List<SubmitDevicesRequest> pending)
    {
        await using var stream = File.Create(_path);
        await JsonSerializer.SerializeAsync(stream, pending);
    }
}
