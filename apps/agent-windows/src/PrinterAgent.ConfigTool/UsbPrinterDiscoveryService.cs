using System.Printing;

namespace PrinterAgent.ConfigTool;

/// <summary>
/// Lists locally-installed printers connected via USB (no SNMP/IP — a USB
/// printer doesn't speak the network protocols the Agent's SNMP reader
/// relies on, so this is Name/Port/Driver only, never counters — spec §67:
/// never invent data the device didn't actually report). Lives in the
/// ConfigTool (not PrinterAgent.Core) because it needs System.Printing,
/// which requires WPF's shared framework — the headless Windows Service
/// never needs USB discovery, only the operator sitting at this machine.
/// </summary>
public class UsbPrinterDiscoveryService
{
    public List<UsbPrinter> Scan()
    {
        var found = new List<UsbPrinter>();
        try
        {
            using var server = new LocalPrintServer();
            var queues = server.GetPrintQueues([
                EnumeratedPrintQueueTypes.Local,
                EnumeratedPrintQueueTypes.Connections,
            ]);
            foreach (var queue in queues)
            {
                var port = queue.QueuePort?.Name ?? "";
                if (!port.StartsWith("USB", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                found.Add(new UsbPrinter
                {
                    Name = queue.Name,
                    Port = port,
                    DriverName = queue.QueueDriver?.Name,
                });
            }
        }
        catch
        {
            // Best-effort local scan — surfaced as an empty list, the UI shows "Nenhuma impressora USB encontrada".
        }
        return found;
    }
}

public class UsbPrinter
{
    public required string Name { get; set; }
    public required string Port { get; set; }
    public string? DriverName { get; set; }
}
