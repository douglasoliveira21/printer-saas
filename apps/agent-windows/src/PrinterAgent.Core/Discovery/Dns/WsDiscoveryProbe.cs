using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;

namespace PrinterAgent.Core.Discovery.Dns;

/// <summary>
/// Fase 12 (WS-Discovery) — one-shot multicast Probe (OASIS/DPWS
/// "WS-Discovery", April 2005 draft — schemas.xmlsoap.org, the version
/// actually implemented by Windows' own WSD stack and by WSD-capable
/// printers/scanners, not the later OASIS-finalized 2009 namespace) to
/// 239.255.255.250:3702, run ONCE per discovery sweep — same shape as
/// <see cref="MdnsProbe"/> and for the same reason (multicast: every
/// WSD-capable host on the LAN answers the same query).
/// <para>
/// Every SOAP envelope, namespace URI, header and body element below is
/// copied verbatim from Microsoft's own WSDAPI documentation (Probe
/// Message / ProbeMatches Message, which cites §5.2/§5.3 of the WS-Discovery
/// spec) — not reconstructed from memory, per the standing rule for this
/// phase: https://learn.microsoft.com/en-us/windows/win32/wsdapi/probe-message
/// and https://learn.microsoft.com/en-us/windows/win32/wsdapi/probematches-message.
/// </para>
/// <para>
/// The Probe itself asks for the generic <c>wsdp:Device</c> type — matched
/// by EVERY DPWS-compliant host (printers, PCs, NAS boxes, ONVIF cameras...),
/// deliberately not narrowed to a printer-specific type at the protocol
/// level. Narrowing happens afterwards, in <see cref="DeviceClassifier"/>,
/// by checking whether the response's own advertised Types contain a
/// print-specific token (e.g. "print:PrintDeviceType", "wprt:PrintDeviceType")
/// — mirroring exactly how <see cref="MdnsProbe"/>'s evidence already works.
/// This is what keeps WS-Discovery from becoming a source of false
/// positives (spec §Fase 12): responding to WS-Discovery at all is never
/// itself printer evidence, only a print-specific advertised type is.
/// </para>
/// </summary>
public class WsDiscoveryProbe
{
    private static readonly IPEndPoint MulticastEndpoint = new(IPAddress.Parse("239.255.255.250"), 3702);

    private const string SoapNs = "http://www.w3.org/2003/05/soap-envelope";
    private const string WsaNs = "http://schemas.xmlsoap.org/ws/2004/08/addressing";
    private const string WsdNs = "http://schemas.xmlsoap.org/ws/2005/04/discovery";
    private const string WsdpNs = "http://schemas.xmlsoap.org/ws/2006/02/devprof";

    private readonly ILogger<WsDiscoveryProbe> _logger;

    public WsDiscoveryProbe(ILogger<WsDiscoveryProbe> logger)
    {
        _logger = logger;
    }

    /// <returns>IP (as string) → the raw whitespace-separated wsd:Types tokens (e.g. "wsdp:Device", "print:PrintDeviceType") seen in each host's ProbeMatches response.</returns>
    public async Task<Dictionary<string, List<string>>> DiscoverAsync(int listenMs, CancellationToken ct)
    {
        var results = new Dictionary<string, List<string>>();
        try
        {
            using var client = new UdpClient(AddressFamily.InterNetwork);
            client.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
            client.Client.Bind(new IPEndPoint(IPAddress.Any, 0));
            client.JoinMulticastGroup(MulticastEndpoint.Address);

            var probe = BuildProbe();
            await client.SendAsync(probe, probe.Length, MulticastEndpoint);

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

                var types = TryParseProbeMatchTypes(received.Buffer);
                if (types.Count == 0)
                {
                    continue;
                }
                var ip = received.RemoteEndPoint.Address.ToString();
                if (!results.TryGetValue(ip, out var list))
                {
                    list = [];
                    results[ip] = list;
                }
                foreach (var type in types)
                {
                    if (!list.Contains(type)) list.Add(type);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "WS-Discovery sweep failed — continuing without WS-Discovery evidence");
        }
        return results;
    }

    internal static byte[] BuildProbe()
    {
        var messageId = $"urn:uuid:{Guid.NewGuid()}";
        var envelope = new XElement(XName.Get("Envelope", SoapNs),
            new XAttribute(XNamespace.Xmlns + "soap", SoapNs),
            new XAttribute(XNamespace.Xmlns + "wsa", WsaNs),
            new XAttribute(XNamespace.Xmlns + "wsd", WsdNs),
            new XAttribute(XNamespace.Xmlns + "wsdp", WsdpNs),
            new XElement(XName.Get("Header", SoapNs),
                new XElement(XName.Get("To", WsaNs), "urn:schemas-xmlsoap-org:ws:2005:04:discovery"),
                new XElement(XName.Get("Action", WsaNs), $"{WsdNs}/Probe"),
                new XElement(XName.Get("MessageID", WsaNs), messageId)),
            new XElement(XName.Get("Body", SoapNs),
                new XElement(XName.Get("Probe", WsdNs),
                    new XElement(XName.Get("Types", WsdNs), "wsdp:Device"))));

        return Encoding.UTF8.GetBytes(new XDocument(envelope).ToString(SaveOptions.DisableFormatting));
    }

    /// <summary>Extracts every wsd:Types token from every wsd:ProbeMatch in the response — malformed/unrelated UDP traffic on this port (there's a fair bit, WS-Discovery is also used by ONVIF cameras and Windows itself) just yields nothing, never throws.</summary>
    internal static List<string> TryParseProbeMatchTypes(byte[] data)
    {
        var found = new List<string>();
        try
        {
            var xml = Encoding.UTF8.GetString(data);
            var doc = XDocument.Parse(xml);
            XNamespace wsd = WsdNs;
            foreach (var typesElement in doc.Descendants(wsd + "ProbeMatch").Elements(wsd + "Types"))
            {
                var tokens = (typesElement.Value ?? string.Empty).Split(
                    (char[]?)null, StringSplitOptions.RemoveEmptyEntries);
                found.AddRange(tokens);
            }
        }
        catch
        {
            // Not a well-formed WS-Discovery ProbeMatches response — ignore it.
        }
        return found;
    }
}
