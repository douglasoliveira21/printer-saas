using Microsoft.Extensions.Logging.Abstractions;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Models;
using PrinterAgent.Core.Queue;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Fase 1 (OfflineQueue atômica) — cada teste usa seu próprio arquivo
/// temporário isolado (nunca toca o ProgramData real), via o construtor
/// internal exposto só para teste em OfflineQueue.
/// </summary>
public class OfflineQueueTests : IDisposable
{
    private readonly string _tempDir;
    private readonly string _queuePath;

    public OfflineQueueTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "PrinterAgentTests_" + Guid.NewGuid());
        Directory.CreateDirectory(_tempDir);
        _queuePath = Path.Combine(_tempDir, "offline-queue.json");
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    private OfflineQueue CreateQueue(int maxEntries = 200) =>
        new(_queuePath, new AgentOptions { OfflineQueueMaxEntries = maxEntries }, NullLogger<OfflineQueue>.Instance);

    private static SubmitDevicesRequest Batch(string ip) =>
        new() { Devices = [new DiscoveredDevice { Ip = ip }] };

    [Fact]
    public async Task Enqueue_then_drain_returns_the_same_batch()
    {
        var queue = CreateQueue();
        await queue.EnqueueAsync(Batch("10.0.0.1"));

        var pending = await queue.DrainAsync();

        Assert.Single(pending);
        Assert.Equal("10.0.0.1", pending[0].Devices[0].Ip);
    }

    [Fact]
    public async Task Drain_on_missing_file_returns_empty_list()
    {
        var queue = CreateQueue();

        var pending = await queue.DrainAsync();

        Assert.Empty(pending);
    }

    [Fact]
    public async Task Drain_on_empty_file_returns_empty_list_not_a_crash()
    {
        await File.WriteAllTextAsync(_queuePath, "");
        var queue = CreateQueue();

        var pending = await queue.DrainAsync();

        Assert.Empty(pending);
    }

    [Fact]
    public async Task Drain_on_corrupted_json_starts_fresh_instead_of_throwing()
    {
        await File.WriteAllTextAsync(_queuePath, "{not valid json[[[");
        var queue = CreateQueue();

        var pending = await queue.DrainAsync();

        Assert.Empty(pending);
    }

    [Fact]
    public async Task Write_is_atomic_a_leftover_tmp_file_never_corrupts_the_real_queue()
    {
        // Simulates a crash mid-write from an EARLIER run: a stale .tmp file
        // sits next to a perfectly valid real queue file. This is exactly
        // the scenario Fase 1 exists to make safe.
        var queue = CreateQueue();
        await queue.EnqueueAsync(Batch("10.0.0.2"));

        await File.WriteAllTextAsync(_queuePath + ".tmp", "{garbage, not json");

        var pending = await queue.DrainAsync();

        Assert.Single(pending);
        Assert.Equal("10.0.0.2", pending[0].Devices[0].Ip);
    }

    [Fact]
    public async Task Previous_valid_file_is_preserved_if_a_write_never_completes()
    {
        // Enqueue A successfully (real file now has A). Then simulate a
        // write for B that crashed BEFORE the atomic File.Move — i.e. only
        // the .tmp file exists with B's content, the real file still has A.
        var queue = CreateQueue();
        await queue.EnqueueAsync(Batch("A"));

        var contentBeforeCrash = await File.ReadAllTextAsync(_queuePath);
        await File.WriteAllTextAsync(_queuePath + ".tmp", "[{\"devices\":[{\"ip\":\"B-never-committed\"}]}]");

        // The real file must be untouched by the abandoned .tmp write.
        var contentAfterSimulatedCrash = await File.ReadAllTextAsync(_queuePath);
        Assert.Equal(contentBeforeCrash, contentAfterSimulatedCrash);

        var pending = await queue.DrainAsync();
        Assert.Single(pending);
        Assert.Equal("A", pending[0].Devices[0].Ip);
    }

    [Fact]
    public async Task Full_queue_drops_oldest_batches_first()
    {
        var queue = CreateQueue(maxEntries: 3);
        await queue.EnqueueAsync(Batch("1"));
        await queue.EnqueueAsync(Batch("2"));
        await queue.EnqueueAsync(Batch("3"));
        await queue.EnqueueAsync(Batch("4"));

        var pending = await queue.DrainAsync();

        Assert.Equal(3, pending.Count);
        Assert.Equal(["2", "3", "4"], pending.Select(p => p.Devices[0].Ip));
    }

    [Fact]
    public async Task Queue_survives_a_new_instance_reading_the_same_file_simulating_a_service_restart()
    {
        var firstInstance = CreateQueue();
        await firstInstance.EnqueueAsync(Batch("survives-restart"));

        // A brand new OfflineQueue instance pointed at the same file — the
        // real AgentWorker does exactly this on every service start.
        var secondInstance = CreateQueue();
        var pending = await secondInstance.DrainAsync();

        Assert.Single(pending);
        Assert.Equal("survives-restart", pending[0].Devices[0].Ip);
    }

    [Fact]
    public async Task Requeue_puts_batches_back_at_the_front_preserving_order()
    {
        var queue = CreateQueue();
        await queue.EnqueueAsync(Batch("already-there"));
        await queue.RequeueAsync([Batch("failed-1"), Batch("failed-2")]);

        var pending = await queue.DrainAsync();

        Assert.Equal(["failed-1", "failed-2", "already-there"], pending.Select(p => p.Devices[0].Ip));
    }

    [Fact]
    public async Task Drain_empties_the_queue()
    {
        var queue = CreateQueue();
        await queue.EnqueueAsync(Batch("x"));
        await queue.DrainAsync();

        var pendingAfterDrain = await queue.DrainAsync();

        Assert.Empty(pendingAfterDrain);
    }
}
