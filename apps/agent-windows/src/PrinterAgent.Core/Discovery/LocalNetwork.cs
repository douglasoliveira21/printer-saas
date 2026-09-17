using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace PrinterAgent.Core.Discovery;

public static class LocalNetwork
{
    /// <summary>Best-effort local IPv4 address for the heartbeat payload — null if none found (spec §67: never fabricate).</summary>
    public static string? GetPrimaryIPv4Address()
    {
        try
        {
            var candidate = NetworkInterface.GetAllNetworkInterfaces()
                .Where(ni => ni.OperationalStatus == OperationalStatus.Up && ni.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                .SelectMany(ni => ni.GetIPProperties().UnicastAddresses)
                .FirstOrDefault(addr => addr.Address.AddressFamily == AddressFamily.InterNetwork);
            return candidate?.Address.ToString();
        }
        catch
        {
            return null;
        }
    }
}
