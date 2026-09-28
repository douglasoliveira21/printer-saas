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

        var requested = new[]
        {
            "printer-make-and-model", "color-supported", "sides-supported", "media-supported", "printer-uuid",
            // Fase 13 (IPP avançado) — RFC 8011 §5.4.11/§5.4.12 (printer-state,
            // printer-state-reasons), PWG5100.13 §5.6.39/§5.6.40
            // (printer-supply, printer-supply-description), RFC 8011 §5.4.16
            // (media-ready).
            "printer-state", "printer-state-reasons", "printer-supply", "printer-supply-description", "media-ready",
        };
        WriteAttribute(0x44, "requested-attributes", requested[0]);
        for (var i = 1; i < requested.Length; i++)
        {
            WriteAdditionalValue(0x44, requested[i]);
        }

        stream.WriteByte(0x03); // end-of-attributes-tag
        return stream.ToArray();
    }

    internal static IppProbeResult ParseResponse(byte[] data)
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

        // Fase 13 (IPP avançado) — printer-state (RFC 8011 §5.4.11, type1
        // enum: 3=idle, 4=processing, 5=stopped — verified against the IANA
        // IPP registrations, not assumed).
        if (attributes.TryGetValue("printer-state", out var stateValues) && int.TryParse(stateValues.FirstOrDefault(), out var stateCode))
        {
            result.PrinterState = stateCode switch
            {
                3 => "idle",
                4 => "processing",
                5 => "stopped",
                _ => null,
            };
        }

        // printer-state-reasons (RFC 8011 §5.4.12) — "none" is the device
        // explicitly saying "nothing to report", never a reason worth
        // surfacing as one.
        if (attributes.TryGetValue("printer-state-reasons", out var reasonValues))
        {
            var reasons = reasonValues.Where(r => !string.Equals(r, "none", StringComparison.OrdinalIgnoreCase)).ToList();
            result.PrinterStateReasons = reasons.Count > 0 ? reasons : null;
        }

        // printer-supply / printer-supply-description (PWG5100.13 §5.6.39-40)
        // — positionally paired, same order, same cardinality (confirmed via
        // the PWG's own IPP mailing list + the CUPS implementation, which
        // maps marker-names 1:1 to printer-supply-description).
        if (attributes.TryGetValue("printer-supply", out var supplyValues))
        {
            var descriptions = attributes.GetValueOrDefault("printer-supply-description") ?? [];
            var supplies = new List<IppSupply>();
            for (var i = 0; i < supplyValues.Count; i++)
            {
                var supply = ParseSupply(supplyValues[i]);
                if (i < descriptions.Count)
                {
                    supply.Description = descriptions[i];
                }
                supplies.Add(supply);
            }
            result.Supplies = supplies.Count > 0 ? supplies : null;
        }

        // media-ready (RFC 8011 §5.4.16) — raw, never interpreted.
        if (attributes.TryGetValue("media-ready", out var mediaReadyValues))
        {
            result.MediaReady = mediaReadyValues.Count > 0 ? mediaReadyValues : null;
        }

        return result;
    }

    /// <summary>
    /// Decodes one printer-supply octetString value — an unordered ASCII
    /// "key=value;key=value;..." text payload (PWG5100.13 §5.6.39, per the
    /// PWG's own IPP mailing-list clarification of that section — this is
    /// NOT a fixed binary struct). Only the keys this client uses are
    /// pulled out; unrecognized keys (index, markerindex, class, unit,
    /// colorantindex, colorantrole, coloranttonality...) are ignored.
    /// </summary>
    internal static IppSupply ParseSupply(string raw)
    {
        var supply = new IppSupply();
        foreach (var pair in raw.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = pair.IndexOf('=');
            if (eq < 0) continue;
            var key = pair[..eq].Trim();
            var value = pair[(eq + 1)..].Trim();

            switch (key)
            {
                case "type":
                    supply.Type = value;
                    break;
                case "level":
                    // -2 = unknown, -1 = unlimited (same RFC 3805 sentinel
                    // convention SnmpDeviceReader already applies) — never
                    // reported as a real level.
                    if (int.TryParse(value, out var level) && level >= 0)
                    {
                        supply.Level = level;
                    }
                    break;
                case "maxcapacity":
                    if (int.TryParse(value, out var maxCapacity) && maxCapacity >= 0)
                    {
                        supply.MaxCapacity = maxCapacity;
                    }
                    break;
                case "colorantname":
                    if (!value.Equals("unknown", StringComparison.OrdinalIgnoreCase) && !value.Equals("other", StringComparison.OrdinalIgnoreCase))
                    {
                        supply.ColorantName = value;
                    }
                    break;
            }
        }
        return supply;
    }

    /// <summary>Only the value tags this client actually cares about — anything else is skipped (returns null), never guessed.</summary>
    private static string? DecodeValue(byte tag, byte[] bytes) => tag switch
    {
        0x22 => bytes.Length > 0 && bytes[0] != 0 ? "true" : "false", // boolean
        0x21 or 0x23 => bytes.Length == 4 ? ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]).ToString() : null, // integer/enum
        0x41 or 0x44 or 0x45 or 0x47 or 0x48 or 0x42 or 0x30 => Encoding.UTF8.GetString(bytes), // textWithoutLanguage/keyword/uri/charset/naturalLanguage/nameWithoutLanguage/octetString
        _ => null,
    };
}
