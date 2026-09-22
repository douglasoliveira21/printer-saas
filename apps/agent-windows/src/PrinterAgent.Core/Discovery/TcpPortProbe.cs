using System.Net.Sockets;

namespace PrinterAgent.Core.Discovery;

/// <summary>
/// Checks a small, fixed set of ports relevant to print/management protocols
/// — auxiliary classification evidence (9100/JetDirect open is a strong
/// printer signal; almost nothing else has it open). Bounded timeout per
/// port, never throws, never blocks the rest of discovery on one slow host.
/// </summary>
public static class TcpPortProbe
{
    public static readonly int[] Ports = [9100, 515, 631, 80, 443];

    public static async Task<HashSet<int>> ProbeAsync(string ip, int timeoutMs, CancellationToken ct)
    {
        var open = new HashSet<int>();
        var checks = Ports.Select(async port =>
        {
            using var client = new TcpClient();
            try
            {
                var connectTask = client.ConnectAsync(ip, port, ct).AsTask();
                var completed = await Task.WhenAny(connectTask, Task.Delay(timeoutMs, ct));
                if (completed == connectTask && client.Connected)
                {
                    lock (open)
                    {
                        open.Add(port);
                    }
                }
            }
            catch
            {
                // Closed/filtered/unreachable — just not open, not an error worth logging per-port.
            }
        });
        await Task.WhenAll(checks);
        return open;
    }
}
