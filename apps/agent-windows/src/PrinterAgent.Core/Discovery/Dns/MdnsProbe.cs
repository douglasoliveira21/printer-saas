using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Logging;

namespace PrinterAgent.Core.Discovery.Dns;

/// <summary>
/// One-shot mDNS (RFC 6762) PTR query for "_ipp._tcp.local" and
/// "_printer._tcp.local" — run ONCE per discovery sweep (mDNS is multicast:
/// every printer on the LAN that supports it answers the same query, unlike
/// SNMP/IPP/TCP which are per-host unicast probes). Best-effort: any
/// malformed response, timeout, or platform without multicast support just
/// yields an empty map, never throws into the caller's discovery loop.
/// </summary>
public class MdnsProbe
{
    private static readonly IPEndPoint MulticastEndpoint = new(IPAddress.Parse("224.0.0.251"), 5353);
    private static readonly string[] ServiceNames = ["_ipp._tcp.local", "_printer._tcp.local"];

    private readonly ILogger<MdnsProbe> _logger;

    public MdnsProbe(ILogger<MdnsProbe> logger)
    {
        _logger = logger;
    }

    /// <returns>IP (as string) → advertised service names (e.g. "_ipp._tcp.local") seen in mDNS answers.</returns>
    public async Task<Dictionary<string, List<string>>> DiscoverAsync(int listenMs, CancellationToken ct)
    {
        var results = new Dictionary<string, List<string>>();
        try
        {
            using var client = new UdpClient(AddressFamily.InterNetwork);
            client.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
            client.Client.Bind(new IPEndPoint(IPAddress.Any, 5353));
            client.JoinMulticastGroup(MulticastEndpoint.Address);

            var query = BuildQuery();
            await client.SendAsync(query, query.Length, MulticastEndpoint);

            var deadline = DateTime.UtcNow.AddMilliseconds(listenMs);
            while (DateTime.UtcNow < deadline && !ct.IsCancellationRequested)
            {
                var remaining = (int)Math.Max(50, (deadline - DateTime.UtcNow).TotalMilliseconds);
                using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeoutCts.CancelAfter(remaining);
                UdpReceiveResult received;
                try
                {
                    received = await client.ReceiveAsync(timeoutCts.Token);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                var serviceNames = TryParseAnsweredServiceNames(received.Buffer);
                if (serviceNames.Count == 0)
                {
                    continue;
                }
                var ip = received.RemoteEndPoint.Address.ToString();
                if (!results.TryGetValue(ip, out var list))
                {
                    list = [];
                    results[ip] = list;
                }
                foreach (var name in serviceNames)
                {
                    if (!list.Contains(name)) list.Add(name);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "mDNS sweep failed — continuing without mDNS evidence");
        }
        return results;
    }

    private static byte[] BuildQuery()
    {
        using var stream = new MemoryStream();
        void WriteBE16(int value) => stream.Write([(byte)(value >> 8), (byte)value]);

        WriteBE16(0); // transaction id
        WriteBE16(0); // flags (standard query)
        WriteBE16(ServiceNames.Length); // qdcount
        WriteBE16(0); WriteBE16(0); WriteBE16(0); // an/ns/ar count

        foreach (var name in ServiceNames)
        {
            foreach (var label in name.Split('.'))
            {
                var bytes = Encoding.ASCII.GetBytes(label);
                stream.WriteByte((byte)bytes.Length);
                stream.Write(bytes);
            }
            stream.WriteByte(0); // root label
            WriteBE16(12); // QTYPE = PTR
            WriteBE16(1);  // QCLASS = IN
        }
        return stream.ToArray();
    }

    /// <summary>Extracts the queried service name (e.g. "_ipp._tcp.local") of each PTR answer record in the response — the fact that this host answered at all is the evidence, not the answer's own payload.</summary>
    private static List<string> TryParseAnsweredServiceNames(byte[] data)
    {
        var found = new List<string>();
        try
        {
            if (data.Length < 12) return found;
            var qdcount = (data[4] << 8) | data[5];
            var ancount = (data[6] << 8) | data[7];
            var pos = 12;

            for (var i = 0; i < qdcount; i++)
            {
                ReadName(data, ref pos);
                pos += 4; // qtype + qclass
            }

            for (var i = 0; i < ancount && pos < data.Length; i++)
            {
                var name = ReadName(data, ref pos);
                if (pos + 10 > data.Length) break;
                pos += 8; // type(2) + class(2) + ttl(4)
                var rdlength = (data[pos] << 8) | data[pos + 1];
                pos += 2;
                pos += rdlength; // skip rdata — we only need which question this answers
                if (ServiceNames.Any(s => string.Equals(s, name, StringComparison.OrdinalIgnoreCase)))
                {
                    found.Add(name);
                }
            }
        }
        catch
        {
            // Malformed/unexpected packet from a device that isn't really speaking mDNS as expected — ignore it.
        }
        return found;
    }

    /// <summary>Reads a (possibly compressed, RFC 1035 §4.1.4) DNS name starting at pos, advancing pos past it.</summary>
    private static string ReadName(byte[] data, ref int pos)
    {
        var labels = new List<string>();
        var jumped = false;
        var originalPos = pos;
        var safety = 0;

        while (pos < data.Length && safety++ < 128)
        {
            var len = data[pos];
            if (len == 0)
            {
                pos++;
                break;
            }
            if ((len & 0xC0) == 0xC0)
            {
                if (pos + 1 >= data.Length) break;
                var pointer = ((len & 0x3F) << 8) | data[pos + 1];
                if (!jumped)
                {
                    originalPos = pos + 2;
                    jumped = true;
                }
                pos = pointer;
                continue;
            }
            pos++;
            if (pos + len > data.Length) break;
            labels.Add(Encoding.ASCII.GetString(data, pos, len));
            pos += len;
        }

        if (jumped)
        {
            pos = originalPos;
        }
        return string.Join('.', labels);
    }
}
