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

    /// <summary>
    /// CIDR of every active, non-loopback/non-virtual IPv4 interface on
    /// this machine (e.g. "192.168.1.0/24") — lets the Agent (or the
    /// installer UI) suggest a sensible discovery target instead of
    /// requiring the operator to know their own subnet mask (spec §15
    /// still requires this to be configurable/overridable, never a hidden
    /// forced scan of something else).
    /// </summary>
    public static List<string> GetLocalIPv4Cidrs()
    {
        try
        {
            return NetworkInterface.GetAllNetworkInterfaces()
                .Where(ni => ni.OperationalStatus == OperationalStatus.Up &&
                             ni.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                             !IsLikelyVirtualAdapter(ni.Description))
                .SelectMany(ni => ni.GetIPProperties().UnicastAddresses)
                .Where(addr => addr.Address.AddressFamily == AddressFamily.InterNetwork && addr.PrefixLength is > 0 and < 32)
                .Select(addr => ToCidr(addr.Address, addr.PrefixLength))
                .Where(cidr => cidr is not null)
                .Distinct()
                .ToList()!;
        }
        catch
        {
            return [];
        }
    }

    private static bool IsLikelyVirtualAdapter(string description)
    {
        var d = description.ToLowerInvariant();
        return d.Contains("virtual") || d.Contains("vmware") || d.Contains("hyper-v") ||
               d.Contains("virtualbox") || d.Contains("loopback") || d.Contains("tunnel") || d.Contains("vpn");
    }

    private static string? ToCidr(IPAddress address, int prefixLength)
    {
        var addressBytes = address.GetAddressBytes();
        if (addressBytes.Length != 4)
        {
            return null;
        }

        uint addressValue = (uint)(addressBytes[0] << 24 | addressBytes[1] << 16 | addressBytes[2] << 8 | addressBytes[3]);
        uint mask = prefixLength == 0 ? 0 : 0xFFFFFFFF << (32 - prefixLength);
        uint network = addressValue & mask;

        var networkBytes = new[] { (byte)(network >> 24), (byte)(network >> 16), (byte)(network >> 8), (byte)network };
        return $"{new IPAddress(networkBytes)}/{prefixLength}";
    }
}
