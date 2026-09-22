namespace PrinterAgent.Core.Discovery;

/// <summary>
/// Discovery makes many concurrent SNMP calls that block their worker
/// thread for real (SharpSnmpLib is synchronous under the hood, wrapped in
/// Task.Run) — the .NET ThreadPool only grows past its default minimum
/// (usually = processor count) gradually under sustained load ("hill
/// climbing", roughly one new thread injected at a time), so on a machine
/// with few cores, a discovery sweep's own concurrency (16 by default) can
/// easily outrun that injection rate. The visible symptom is a scan that
/// appears to freeze partway through and never recovers in any reasonable
/// time — not a deadlock, but starvation severe enough to look like one.
/// Call this once, early, before any scan runs, so the pool already has
/// enough worker threads instead of growing into demand reactively.
/// </summary>
public static class ThreadPoolWarmup
{
    public static void EnsureMinThreads(int expectedConcurrency)
    {
        ThreadPool.GetMinThreads(out var workerThreads, out var completionPortThreads);
        var target = Math.Max(expectedConcurrency * 2, 32);
        ThreadPool.SetMinThreads(Math.Max(workerThreads, target), Math.Max(completionPortThreads, target));
    }
}
