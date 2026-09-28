using System.Net.Http;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace PrinterAgent.Core.Vendors;

/// <summary>
/// Samsung's SyncThru Web Service (the printer's own embedded, unauthenticated
/// HTTP admin page — confirmed against a real SL-M4070FR: DevTools Network
/// tab, request <c>GET /sws/app/information/counters/counters.json</c>)
/// exposes a print/copy/fax/report/duplex/scan breakdown that plain
/// Printer-MIB (RFC 3805) has no OID for at all — RFC 3805's
/// prtMarkerLifeCount is a single running total per marker, nothing splits
/// it by job origin. This is the vendor HTTP API extension point
/// <see cref="IPrinterVendorProvider"/>'s own doc comment already
/// anticipated. Only ever tried for Samsung devices (manufacturer already
/// confirmed by SNMP/IPP first) — never guessed for anything else, and a
/// failure/unavailable page is treated as "not available", same as every
/// other optional source in this codebase.
/// <para>
/// The response is NOT strict JSON — Samsung serves an unquoted
/// JS-object-literal (<c>KEY: 123,</c>), so this reads it with a targeted
/// regex over the exact field names confirmed in the real response, rather
/// than a JSON parser that would reject it outright.
/// </para>
/// </summary>
public class SamsungCountersClient
{
    private readonly HttpClient _http;
    private readonly ILogger<SamsungCountersClient> _logger;

    public SamsungCountersClient(HttpClient http, ILogger<SamsungCountersClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<SamsungCounterSnapshot?> ProbeAsync(string ip, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(timeoutMs);

            var uri = new Uri($"http://{ip}/sws/app/information/counters/counters.json");
            using var response = await _http.GetAsync(uri, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var body = await response.Content.ReadAsStringAsync(cts.Token);
            var snapshot = Parse(body);
            return snapshot.HasAnyValue ? snapshot : null;
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Samsung SyncThru counters probe failed for {Ip}", ip);
            return null;
        }
    }

    /// <summary>
    /// Extracts exactly the fields confirmed present in a real response
    /// (see the class doc comment) — any other GXI_* field Samsung's
    /// firmware happens to also include is deliberately left alone.
    /// </summary>
    internal static SamsungCounterSnapshot Parse(string body)
    {
        int? Field(string name)
        {
            var match = Regex.Match(body, $@"{Regex.Escape(name)}\s*:\s*(-?\d+)");
            return match.Success && int.TryParse(match.Groups[1].Value, out var value) ? value : null;
        }

        return new SamsungCounterSnapshot
        {
            PrintTotal = Field("GXI_BILLING_PRINT_TOTAL_IMP_CNT"),
            CopyTotal = Field("GXI_BILLING_COPY_TOTAL_IMP_CNT"),
            FaxTotal = Field("GXI_BILLING_FAX_TOTAL_IMP_CNT"),
            ReportTotal = Field("GXI_BILLING_REPORT_TOTAL_IMP_CNT"),
            GrandTotal = Field("GXI_BILLING_TOTAL_IMP_CNT"),
            DuplexBwTotal = Field("GXI_BILLING_DUPLEX_BW_TOTAL_CNT"),
            DuplexColorTotal = Field("GXI_BILLING_DUPLEX_COLOR_TOTAL_CNT"),
            ScanTotal = Field("GXI_BILLING_SEND_TO_TOTAL_CNT"),
        };
    }
}

/// <summary>
/// One Samsung SyncThru "counters.json" reading. Every field is the exact
/// GXI_BILLING_* value the device itself reported — null means the field
/// wasn't present in this device's response (older/newer firmware may not
/// expose all of them), never a guessed zero.
/// </summary>
public class SamsungCounterSnapshot
{
    public int? PrintTotal { get; set; }
    public int? CopyTotal { get; set; }
    public int? FaxTotal { get; set; }
    public int? ReportTotal { get; set; }
    public int? GrandTotal { get; set; }
    public int? DuplexBwTotal { get; set; }
    public int? DuplexColorTotal { get; set; }
    public int? ScanTotal { get; set; }

    public int? DuplexTotal => DuplexBwTotal is null && DuplexColorTotal is null
        ? null
        : (DuplexBwTotal ?? 0) + (DuplexColorTotal ?? 0);

    internal bool HasAnyValue =>
        PrintTotal is not null || CopyTotal is not null || FaxTotal is not null || ReportTotal is not null ||
        GrandTotal is not null || DuplexBwTotal is not null || DuplexColorTotal is not null || ScanTotal is not null;
}
