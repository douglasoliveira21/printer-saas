using System.Net;

namespace PrinterAgent.Core.Discovery;

/// <summary>
/// Parses a discovery target as configured by the operator (spec §15):
/// "192.168.1.0/24" (subnet), "192.168.1.10" (single IP), or
/// "192.168.1.100-192.168.1.200" (range).
/// </summary>
public static class NetworkRange
{
    public static IEnumerable<IPAddress> Expand(string target)
    {
        target = target.Trim();

        if (target.Contains('/'))
        {
            return ExpandCidr(target);
        }

        if (target.Contains('-'))
        {
            var parts = target.Split('-', 2, StringSplitOptions.TrimEntries);
            return ExpandRange(IPAddress.Parse(parts[0]), IPAddress.Parse(parts[1]));
        }

        return [IPAddress.Parse(target)];
    }

    private static IEnumerable<IPAddress> ExpandCidr(string cidr)
    {
        var parts = cidr.Split('/');
        var baseAddress = IPAddress.Parse(parts[0]);
        var prefixLength = int.Parse(parts[1]);

        if (baseAddress.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
        {
            throw new NotSupportedException("Only IPv4 discovery ranges are supported");
        }

        var addressBytes = baseAddress.GetAddressBytes();
        uint baseValue = (uint)(addressBytes[0] << 24 | addressBytes[1] << 16 | addressBytes[2] << 8 | addressBytes[3]);
        uint mask = prefixLength == 0 ? 0 : 0xFFFFFFFF << (32 - prefixLength);
        uint network = baseValue & mask;
        uint broadcast = network | ~mask;

        // Skip network/broadcast addresses for typical subnets (prefix < 31).
        var start = prefixLength < 31 ? network + 1 : network;
        var end = prefixLength < 31 ? broadcast - 1 : broadcast;

        for (var value = start; value <= end; value++)
        {
            yield return new IPAddress([(byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value]);
        }
    }

    private static IEnumerable<IPAddress> ExpandRange(IPAddress start, IPAddress end)
    {
        var startBytes = start.GetAddressBytes();
        var endBytes = end.GetAddressBytes();
        uint startValue = (uint)(startBytes[0] << 24 | startBytes[1] << 16 | startBytes[2] << 8 | startBytes[3]);
        uint endValue = (uint)(endBytes[0] << 24 | endBytes[1] << 16 | endBytes[2] << 8 | endBytes[3]);

        for (var value = startValue; value <= endValue; value++)
        {
            yield return new IPAddress([(byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value]);
        }
    }
}
