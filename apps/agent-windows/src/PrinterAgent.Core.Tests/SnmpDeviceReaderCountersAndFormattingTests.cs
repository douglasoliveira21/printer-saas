using Lextm.SharpSnmpLib;
using PrinterAgent.Core.Models;
using PrinterAgent.Core.Snmp;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Fase 14 (testes finais) — SNMP: pina em teste dois pontos que até agora
/// só foram validados manualmente/em produção:
/// <list type="bullet">
/// <item>FormatSnmpData — a raiz do bug real encontrado nesta sessão
/// (SharpSnmpLib 13.0.0-beta.3's Counter32/Gauge32/Counter64.ToString()
/// retornava "Counter32 { Value = ... }" em vez do número puro, quebrando
/// contadores de página em produção até então).</item>
/// <item>ClassifyCounters — a lógica de separar contador mono de colorido
/// por colorante (RFC 3805 prtMarkerProcessColorants), nunca testada
/// diretamente antes (só exercida via chamadas de rede reais).</item>
/// </list>
/// </summary>
public class SnmpDeviceReaderCountersAndFormattingTests
{
    [Fact]
    public void FormatSnmpData_Counter32_retorna_o_numero_puro_nao_o_ToString_de_record()
    {
        var result = SnmpDeviceReader.FormatSnmpData(new Counter32(49484));

        Assert.Equal("49484", result);
    }

    [Fact]
    public void FormatSnmpData_Gauge32_retorna_o_numero_puro()
    {
        var result = SnmpDeviceReader.FormatSnmpData(new Gauge32(100));

        Assert.Equal("100", result);
    }

    [Fact]
    public void FormatSnmpData_Counter64_retorna_o_numero_puro()
    {
        var result = SnmpDeviceReader.FormatSnmpData(new Counter64(123456789012));

        Assert.Equal("123456789012", result);
    }

    [Fact]
    public void FormatSnmpData_Integer32_nunca_foi_afetado_pelo_bug_mas_continua_correto()
    {
        var result = SnmpDeviceReader.FormatSnmpData(new Integer32(42));

        Assert.Equal("42", result);
    }

    [Fact]
    public void FormatSnmpData_OctetString_nunca_foi_afetado_pelo_bug_mas_continua_correto()
    {
        var result = SnmpDeviceReader.FormatSnmpData(new OctetString("HP LaserJet P1102w"));

        Assert.Equal("HP LaserJet P1102w", result);
    }

    [Fact]
    public void ClassifyCounters_marcador_mono_soma_em_BlackWhite()
    {
        var lifeCounts = new Dictionary<string, string> { [$"{PrinterMibOids.PrtMarkerLifeCountTable}.1"] = "1000" };
        var colorants = new Dictionary<string, string> { [$"{PrinterMibOids.PrtMarkerProcessColorantsTable}.1"] = "black" };

        var result = SnmpDeviceReader.ClassifyCounters(lifeCounts, colorants);

        Assert.Equal(1000, result.Total);
        Assert.Equal(1000, result.BlackWhite);
        Assert.Null(result.Color);
    }

    [Fact]
    public void ClassifyCounters_marcador_colorido_soma_em_Color()
    {
        var lifeCounts = new Dictionary<string, string> { [$"{PrinterMibOids.PrtMarkerLifeCountTable}.1"] = "500" };
        var colorants = new Dictionary<string, string> { [$"{PrinterMibOids.PrtMarkerProcessColorantsTable}.1"] = "cyan-magenta-yellow-black" };

        var result = SnmpDeviceReader.ClassifyCounters(lifeCounts, colorants);

        Assert.Equal(500, result.Total);
        Assert.Null(result.BlackWhite);
        Assert.Equal(500, result.Color);
    }

    [Fact]
    public void ClassifyCounters_dois_marcadores_mono_e_colorido_somam_em_Total_e_se_separam_corretamente()
    {
        var lifeCounts = new Dictionary<string, string>
        {
            [$"{PrinterMibOids.PrtMarkerLifeCountTable}.1"] = "1000",
            [$"{PrinterMibOids.PrtMarkerLifeCountTable}.2"] = "250",
        };
        var colorants = new Dictionary<string, string>
        {
            [$"{PrinterMibOids.PrtMarkerProcessColorantsTable}.1"] = "black",
            [$"{PrinterMibOids.PrtMarkerProcessColorantsTable}.2"] = "cyan-magenta-yellow-black",
        };

        var result = SnmpDeviceReader.ClassifyCounters(lifeCounts, colorants);

        Assert.Equal(1250, result.Total);
        Assert.Equal(1000, result.BlackWhite);
        Assert.Equal(250, result.Color);
    }

    [Fact]
    public void ClassifyCounters_marcador_sem_colorante_conhecido_soma_so_em_Total()
    {
        var lifeCounts = new Dictionary<string, string> { [$"{PrinterMibOids.PrtMarkerLifeCountTable}.1"] = "700" };
        var colorants = new Dictionary<string, string>(); // dispositivo não expõe prtMarkerProcessColorants pra esse marcador

        var result = SnmpDeviceReader.ClassifyCounters(lifeCounts, colorants);

        Assert.Equal(700, result.Total);
        Assert.Null(result.BlackWhite);
        Assert.Null(result.Color);
    }

    [Fact]
    public void ClassifyCounters_valor_nao_numerico_e_ignorado_sem_quebrar()
    {
        var lifeCounts = new Dictionary<string, string> { [$"{PrinterMibOids.PrtMarkerLifeCountTable}.1"] = "NoSuchObject" };

        var result = SnmpDeviceReader.ClassifyCounters(lifeCounts, new Dictionary<string, string>());

        Assert.Null(result.Total);
    }
}
