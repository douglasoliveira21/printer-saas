using System.Net.Http;
using System.Text;
using Microsoft.Extensions.Logging;
using PrinterAgent.Core.Classification;

namespace PrinterAgent.Core.Discovery.Ipp;

/// <summary>
/// Minimal IPP 1.1 client (RFC 8011) — encodes and sends a single
/// Get-Printer-Attributes request and decodes just the handful of
/// attributes the classifier/capability model actually needs. Not a
/// general-purpose IPP library: no job submission, no authentication, no
/// attribute we don't use. A device that isn't a printer (or doesn't speak
/// IPP) simply times out or returns something unparseable — treated as
/// "IPP not available", never as an error that stops discovery.
/// </summary>
public class IppClient
{
    private const int GetPrinterAttributesOperationId = 0x000B;

    private static readonly (int Port, bool UseTls)[] Endpoints = [(631, false), (80, false), (443, true)];

    private readonly HttpClient _http;
    private readonly ILogger<IppClient> _logger;

    public IppClient(HttpClient http, ILogger<IppClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<IppProbeResult> ProbeAsync(string ip, int timeoutMs, CancellationToken ct)
    {
        foreach (var (port, useTls) in Endpoints)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(timeoutMs);
            try
            {
                var scheme = useTls ? "https" : "http";
                var uri = new Uri($"{scheme}://{ip}:{port}/ipp/print");
                var printerUri = $"ipp://{ip}:{port}/ipp/print";

                var body = BuildGetPrinterAttributesRequest(printerUri);
                using var content = new ByteArrayContent(body);
                content.Headers.Add("Content-Type", "application/ipp");

                using var response = await _http.PostAsync(uri, content, cts.Token);
                if (!response.IsSuccessStatusCode)
                {
                    continue;
                }
                var responseBytes = await response.Content.ReadAsByteArrayAsync(cts.Token);
                var result = ParseResponse(responseBytes);
                if (result.Responded)
                {
                    return result;
                }
            }
            catch (OperationCanceledException)
            {
                // Timed out on this endpoint — try the next one.
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "IPP probe failed for {Ip}:{Port}", ip, port);
            }
        }
        return new IppProbeResult { Responded = false };
    }

    private static byte[] BuildGetPrinterAttributesRequest(string printerUri)
    {
        using var stream = new MemoryStream();
        void WriteBE16(int value) => stream.Write([(byte)(value >> 8), (byte)value]);

        void WriteAttribute(byte tag, string name, string value)
        {
            stream.WriteByte(tag);
            var nameBytes = Encoding.ASCII.GetBytes(name);
            WriteBE16(nameBytes.Length);
            stream.Write(nameBytes);
            var valueBytes = Encoding.UTF8.GetBytes(value);
            WriteBE16(valueBytes.Length);
            stream.Write(valueBytes);
        }

        void WriteAdditionalValue(byte tag, string value)
        {
            stream.WriteByte(tag);
            WriteBE16(0); // empty name = "another value of the previous attribute"
            var valueBytes = Encoding.UTF8.GetBytes(value);
            WriteBE16(valueBytes.Length);
            stream.Write(valueBytes);
        }

        // version 1.1
        stream.WriteByte(0x01);
        stream.WriteByte(0x01);
        WriteBE16(GetPrinterAttributesOperationId);
        stream.Write([0x00, 0x00, 0x00, 0x01]); // request-id = 1

        stream.WriteByte(0x01); // operation-attributes-tag
        WriteAttribute(0x47, "attributes-charset", "utf-8");
        WriteAttribute(0x48, "attributes-natural-language", "en");
        WriteAttribute(0x45, "printer-uri", printerUri);

        var requested = new[] { "printer-make-and-model", "color-supported", "sides-supported", "media-supported", "printer-uuid" };
        WriteAttribute(0x44, "requested-attributes", requested[0]);
        for (var i = 1; i < requested.Length; i++)
        {
            WriteAdditionalValue(0x44, requested[i]);
        }

        stream.WriteByte(0x03); // end-of-attributes-tag
        return stream.ToArray();
    }

    private static IppProbeResult ParseResponse(byte[] data)
    {
        var result = new IppProbeResult();
        if (data.Length < 8)
        {
            return result;
        }

        var pos = 8; // skip version(2) + status-code(2) + request-id(4)
        var attributes = new Dictionary<string, List<string>>();
        string? lastName = null;

        while (pos < data.Length)
        {
            var tag = data[pos++];
            if (tag == 0x03) // end-of-attributes
            {
                break;
            }
            if (tag is <= 0x0F) // delimiter tag (operation/job/printer/unsupported-attributes group start)
            {
                lastName = null;
                continue;
            }
            if (pos + 2 > data.Length) break;
            var nameLen = (data[pos] << 8) | data[pos + 1];
            pos += 2;
            string name;
            if (nameLen == 0)
            {
                name = lastName ?? "";
            }
            else
            {
                if (pos + nameLen > data.Length) break;
                name = Encoding.ASCII.GetString(data, pos, nameLen);
                pos += nameLen;
                lastName = name;
            }
            if (pos + 2 > data.Length) break;
            var valueLen = (data[pos] << 8) | data[pos + 1];
            pos += 2;
            if (pos + valueLen > data.Length) break;
            var valueBytes = data[pos..(pos + valueLen)];
            pos += valueLen;

            if (string.IsNullOrEmpty(name)) continue;

            var decoded = DecodeValue(tag, valueBytes);
            if (decoded is null) continue;
            if (!attributes.TryGetValue(name, out var list))
            {
                list = [];
                attributes[name] = list;
            }
            list.Add(decoded);
        }

        if (attributes.Count == 0)
        {
            return result;
        }

        result.Responded = true;
        result.MakeAndModel = attributes.GetValueOrDefault("printer-make-and-model")?.FirstOrDefault();
        result.PrinterUuid = attributes.GetValueOrDefault("printer-uuid")?.FirstOrDefault();

        if (attributes.TryGetValue("color-supported", out var colorValues))
        {
            result.ColorSupported = colorValues.FirstOrDefault() == "true";
        }
        if (attributes.TryGetValue("sides-supported", out var sidesValues))
        {
            result.DuplexSupported = sidesValues.Any(v => v.Contains("two-sided", StringComparison.OrdinalIgnoreCase));
        }
        if (attributes.TryGetValue("media-supported", out var mediaValues))
        {
            result.A3Supported = mediaValues.Any(v => v.Contains("iso_a3", StringComparison.OrdinalIgnoreCase) || v.Contains("a3_297", StringComparison.OrdinalIgnoreCase));
        }

        return result;
    }

    /// <summary>Only the value tags this client actually cares about — anything else is skipped (returns null), never guessed.</summary>
    private static string? DecodeValue(byte tag, byte[] bytes) => tag switch
    {
        0x22 => bytes.Length > 0 && bytes[0] != 0 ? "true" : "false", // boolean
        0x21 or 0x23 => bytes.Length == 4 ? ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]).ToString() : null, // integer/enum
        0x41 or 0x44 or 0x45 or 0x47 or 0x48 or 0x42 => Encoding.UTF8.GetString(bytes), // textWithoutLanguage/keyword/uri/charset/naturalLanguage/nameWithoutLanguage
        _ => null,
    };
}
