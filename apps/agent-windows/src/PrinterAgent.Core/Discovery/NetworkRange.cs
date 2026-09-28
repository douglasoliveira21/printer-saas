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

    /// <summary>
    /// Fase 7 (validação de Network Range) — how many hosts a target would
    /// expand to, computed arithmetically instead of actually enumerating.
    /// Lets the caller reject an absurdly large range (a /16 typed instead
    /// of a /24, for instance) BEFORE paying the cost of materializing or
    /// scanning it — <see cref="Expand"/> itself is already a lazy
    /// generator, so this isn't about protecting it, it's about giving the
    /// caller a cheap number to validate against a configured ceiling.
    /// </summary>
    public static long EstimateHostCount(string target)
    {
        target = target.Trim();

        if (target.Contains('/'))
        {
            var parts = target.Split('/');
            var baseAddress = IPAddress.Parse(parts[0]);
            var prefixLength = int.Parse(parts[1]);
            if (baseAddress.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
            {
                throw new NotSupportedException("Only IPv4 discovery ranges are supported");
            }
            var hostBits = 32 - prefixLength;
            var total = hostBits >= 32 ? 4294967296L : 1L << hostBits;
            // Same network/broadcast exclusion as ExpandCidr, for an exact (not approximate) count.
            return prefixLength < 31 ? Math.Max(0, total - 2) : total;
        }

        if (target.Contains('-'))
        {
            var parts = target.Split('-', 2, StringSplitOptions.TrimEntries);
            var start = ToUInt32(IPAddress.Parse(parts[0]));
            var end = ToUInt32(IPAddress.Parse(parts[1]));
            return end >= start ? end - start + 1L : 0;
        }

        return 1;
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

        uint baseValue = ToUInt32(baseAddress);
        uint mask = prefixLength == 0 ? 0 : 0xFFFFFFFF << (32 - prefixLength);
        uint network = baseValue & mask;
        uint broadcast = network | ~mask;

        // Skip network/broadcast addresses for typical subnets (prefix < 31).
        var start = prefixLength < 31 ? network + 1 : network;
        var end = prefixLength < 31 ? broadcast - 1 : broadcast;

        for (var value = start; value <= end; value++)
        {
            yield return ToIPAddress(value);
        }
    }

    private static IEnumerable<IPAddress> ExpandRange(IPAddress start, IPAddress end)
    {
        uint startValue = ToUInt32(start);
        uint endValue = ToUInt32(end);

        for (var value = startValue; value <= endValue; value++)
        {
            yield return ToIPAddress(value);
        }
    }

    private static uint ToUInt32(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return (uint)(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]);
    }

    private static IPAddress ToIPAddress(uint value) =>
        new([(byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value]);
}
