using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;

namespace PrinterAgent.Core.Snmp;

/// <summary>
/// Resolves an IPv4 address to its MAC via the OS ARP cache (Win32
/// <c>SendARP</c>) — same-subnet only, ARP doesn't cross routers. This is
/// the primary MAC source for discovered printers: it's more reliable than
/// walking Printer-MIB's IF-MIB table, since it works even when a device
/// restricts SNMP read access to just the Printer-MIB subtree (common on
/// consumer/SMB printers) and needs no SNMP round trip at all.
/// </summary>
[SupportedOSPlatform("windows")]
public static class ArpResolver
{
    [DllImport("iphlpapi.dll", ExactSpelling = true)]
    private static extern int SendARP(uint destIp, uint srcIp, byte[] macAddr, ref uint macAddrLen);

    public static string? ResolveMac(IPAddress ip)
    {
        if (ip.AddressFamily != AddressFamily.InterNetwork)
        {
            return null;
        }
        try
        {
            var destIp = BitConverter.ToUInt32(ip.GetAddressBytes(), 0);
            var mac = new byte[6];
            var macLen = (uint)mac.Length;
            var result = SendARP(destIp, 0, mac, ref macLen);
            if (result != 0 || macLen != 6 || mac.All(b => b == 0))
            {
                return null;
            }
            return string.Join(":", mac.Select(b => b.ToString("X2")));
        }
        catch
        {
            // ARP unsupported/blocked in this environment — caller falls back to SNMP.
            return null;
        }
    }
}
