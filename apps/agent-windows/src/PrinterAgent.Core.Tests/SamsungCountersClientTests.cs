using PrinterAgent.Core.Discovery;
using PrinterAgent.Core.Models;
using PrinterAgent.Core.Vendors;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Samsung SyncThru "counters.json" — a print/copy/fax/report/duplex/scan
/// breakdown Printer-MIB has no OID for at all. The sample payload below is
/// copied verbatim (field names/values) from a real Samsung SL-M4070FR's
/// actual HTTP response (captured via the browser's own DevTools Network
/// tab against the live device), not invented — see
/// SamsungCountersClient.cs's own doc comment for the exact request that
/// produced it.
/// </summary>
public class SamsungCountersClientTests
{
    private const string RealSampleResponse = """
        {
        	GXI_SYS_SERIAL_NUM: "ZER4BQAF200292F",
        	GXI_SUPPORT_COLOR: 0,
        	GXI_BILLING_SIMPLEX_BW_PRINT_CNT: 234,
        	GXI_BILLING_SIMPLEX_BW_COPY_CNT: 22,
        	GXI_BILLING_SIMPLEX_BW_FAX_CNT: 0,
        	GXI_BILLING_SIMPLEX_BW_REPORT_CNT: 6,
        	GXI_BILLING_SIMPLEX_BW_TOTAL_CNT: 262,
        	GXI_BILLING_DUPLEX_BW_PRINT_CNT: 8,
        	GXI_BILLING_DUPLEX_BW_COPY_CNT: 0,
        	GXI_BILLING_DUPLEX_BW_FAX_CNT: 0,
        	GXI_BILLING_DUPLEX_BW_REPORT_CNT: 2,
        	GXI_BILLING_DUPLEX_BW_TOTAL_CNT: 10,
        	GXI_BILLING_DUPLEX_COLOR_TOTAL_CNT: 0,
        	GXI_BILLING_PRINT_TOTAL_IMP_CNT: 242,
        	GXI_BILLING_COPY_TOTAL_IMP_CNT: 22,
        	GXI_BILLING_FAX_TOTAL_IMP_CNT: 0,
        	GXI_BILLING_REPORT_TOTAL_IMP_CNT: 8,
        	GXI_BILLING_TOTAL_IMP_CNT: 272,
        	GXI_BILLING_SEND_TO_OTHERS_CNT: 76,
        	GXI_BILLING_SEND_TO_TOTAL_CNT: 76
        }
        """;

    [Fact]
    public void Parse_le_todos_os_campos_confirmados_do_payload_real()
    {
        var snapshot = SamsungCountersClient.Parse(RealSampleResponse);

        Assert.Equal(242, snapshot.PrintTotal);
        Assert.Equal(22, snapshot.CopyTotal);
        Assert.Equal(0, snapshot.FaxTotal);
        Assert.Equal(8, snapshot.ReportTotal);
        Assert.Equal(272, snapshot.GrandTotal);
        Assert.Equal(10, snapshot.DuplexBwTotal);
        Assert.Equal(0, snapshot.DuplexColorTotal);
        Assert.Equal(10, snapshot.DuplexTotal); // 10 + 0
        Assert.Equal(76, snapshot.ScanTotal);
    }

    [Fact]
    public void Parse_payload_vazio_ou_sem_os_campos_nao_tem_nenhum_valor()
    {
        var snapshot = SamsungCountersClient.Parse("{ }");

        Assert.False(snapshot.HasAnyValue);
    }

    [Fact]
    public void Parse_pagina_de_erro_HTML_nao_gera_nenhum_valor_falso()
    {
        // Ex.: a impressora pede login pra essa URL específica em outro
        // firmware/modelo, ou a rota simplesmente não existe — nunca deve
        // virar um "0" inventado.
        var snapshot = SamsungCountersClient.Parse("<html><body>404 Not Found</body></html>");

        Assert.False(snapshot.HasAnyValue);
    }

    [Fact]
    public void DuplexTotal_fica_null_quando_nenhum_dos_dois_campos_de_origem_existe()
    {
        var snapshot = SamsungCountersClient.Parse("{ GXI_BILLING_PRINT_TOTAL_IMP_CNT: 100 }");

        Assert.Null(snapshot.DuplexTotal);
    }

    [Fact]
    public void MergeSamsungCounters_preenche_Copies_quando_SNMP_nao_tinha_nenhum_contador()
    {
        var device = new DiscoveredDevice { Counters = null };
        var snapshot = SamsungCountersClient.Parse(RealSampleResponse);

        DeviceProbeOrchestrator.MergeSamsungCounters(device, snapshot);

        Assert.Equal(22, device.Counters!.Copies);
        Assert.Equal("samsung_syncthru", device.CapabilitySources["copies"]);
    }

    [Fact]
    public void MergeSamsungCounters_NUNCA_sobrescreve_Total_BlackWhite_Color_ja_lidos_via_SNMP()
    {
        var device = new DiscoveredDevice
        {
            Counters = new DeviceCounters { Total = 999, BlackWhite = 999, Color = 0 },
        };
        var snapshot = SamsungCountersClient.Parse(RealSampleResponse);

        DeviceProbeOrchestrator.MergeSamsungCounters(device, snapshot);

        Assert.Equal(999, device.Counters.Total);
        Assert.Equal(999, device.Counters.BlackWhite);
        Assert.Equal(0, device.Counters.Color);
        Assert.Equal(22, device.Counters.Copies); // só o campo sem fonte SNMP é preenchido
    }

    [Fact]
    public void MergeSamsungCounters_guarda_duplex_relatorio_fax_e_scan_no_campo_Raw()
    {
        var device = new DiscoveredDevice();
        var snapshot = SamsungCountersClient.Parse(RealSampleResponse);

        DeviceProbeOrchestrator.MergeSamsungCounters(device, snapshot);

        Assert.Equal(10, device.Counters!.Raw!["samsung_duplex_total"]);
        Assert.Equal(76, device.Counters.Raw["samsung_scan_total"]);
        Assert.Equal(8, device.Counters.Raw["samsung_report_total"]);
        Assert.Equal(272, device.Counters.Raw["samsung_grand_total"]);
    }
}
