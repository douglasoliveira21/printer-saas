using PrinterAgent.Core.Models;
using PrinterAgent.Core.Snmp;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Fase 11 (cobertura de Printer-MIB) — prtMarkerSuppliesType,
/// prtMarkerSuppliesColorantIndex/prtMarkerColorantTable e prtCoverTable.
/// Enum values sourced from the authoritative IANA-PRINTER-MIB registry
/// (see PrinterMibOids.MarkerSuppliesTypeNames/CoverStatusNames doc
/// comments) — these tests pin those exact values against regressions.
/// </summary>
public class SnmpDeviceReaderSuppliesAndCoversTests
{
    private const string TypeTable = PrinterMibOids.PrtMarkerSuppliesTypeTable;
    private const string ColorantIndexTable = PrinterMibOids.PrtMarkerSuppliesColorantIndexTable;
    private const string ColorantValueTable = PrinterMibOids.PrtMarkerColorantValueTable;
    private const string CoverStatusTable = PrinterMibOids.PrtCoverStatusTable;
    private const string CoverDescriptionTable = PrinterMibOids.PrtCoverDescriptionTable;

    [Theory]
    [InlineData(3, "toner")]
    [InlineData(4, "wasteToner")]
    [InlineData(9, "opc")]
    [InlineData(15, "fuser")]
    [InlineData(34, "covers")]
    public void ResolveSupplyType_mapeia_o_valor_real_do_dispositivo(int rawValue, string expected)
    {
        var types = new Dictionary<string, string> { [$"{TypeTable}.1"] = rawValue.ToString() };

        var result = SnmpDeviceReader.ResolveSupplyType("1", types, TypeTable);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void ResolveSupplyType_sem_a_coluna_no_dispositivo_cai_no_fallback_toner()
    {
        var types = new Dictionary<string, string>();

        var result = SnmpDeviceReader.ResolveSupplyType("1", types, TypeTable);

        Assert.Equal("toner", result);
    }

    [Fact]
    public void ResolveSupplyType_valor_fora_da_enumeracao_cai_no_fallback_toner()
    {
        // 999 nunca existiu em nenhuma versão do IANA-PRINTER-MIB — não pode
        // virar um nome inventado, só o fallback documentado.
        var types = new Dictionary<string, string> { [$"{TypeTable}.1"] = "999" };

        var result = SnmpDeviceReader.ResolveSupplyType("1", types, TypeTable);

        Assert.Equal("toner", result);
    }

    [Fact]
    public void ResolveSupplyColor_usa_prtMarkerColorantValue_quando_disponivel_mesmo_sem_a_cor_na_descricao()
    {
        var colorantIndexes = new Dictionary<string, string> { [$"{ColorantIndexTable}.1"] = "1" };
        var colorantValues = new Dictionary<string, string> { [$"{ColorantValueTable}.1"] = "cyan" };

        var result = SnmpDeviceReader.ResolveSupplyColor(
            "Print Cartridge", "1", colorantIndexes, colorantValues, ColorantIndexTable, ColorantValueTable);

        Assert.Equal("cyan", result);
    }

    [Fact]
    public void ResolveSupplyColor_colorantIndex_zero_cai_pro_keyword_match_na_descricao()
    {
        var colorantIndexes = new Dictionary<string, string> { [$"{ColorantIndexTable}.1"] = "0" };
        var colorantValues = new Dictionary<string, string>();

        var result = SnmpDeviceReader.ResolveSupplyColor(
            "Black Toner Cartridge", "1", colorantIndexes, colorantValues, ColorantIndexTable, ColorantValueTable);

        Assert.Equal("black", result);
    }

    [Fact]
    public void ResolveSupplyColor_colorantValue_other_ou_unknown_tambem_cai_pro_keyword_match()
    {
        var colorantIndexes = new Dictionary<string, string> { [$"{ColorantIndexTable}.1"] = "1" };
        var colorantValues = new Dictionary<string, string> { [$"{ColorantValueTable}.1"] = "unknown" };

        var result = SnmpDeviceReader.ResolveSupplyColor(
            "Yellow Toner", "1", colorantIndexes, colorantValues, ColorantIndexTable, ColorantValueTable);

        Assert.Equal("yellow", result);
    }

    [Fact]
    public void ResolveSupplyColor_sem_nenhuma_fonte_retorna_null_em_vez_de_adivinhar()
    {
        var result = SnmpDeviceReader.ResolveSupplyColor(
            "Waste Toner Bottle", "1", new Dictionary<string, string>(), new Dictionary<string, string>(),
            ColorantIndexTable, ColorantValueTable);

        Assert.Null(result);
    }

    [Fact]
    public void BuildCoverAlerts_capa_aberta_vira_alerta_warning()
    {
        var statuses = new Dictionary<string, string> { [$"{CoverStatusTable}.1"] = "3" }; // coverOpen
        var descriptions = new Dictionary<string, string> { [$"{CoverDescriptionTable}.1"] = "Front Door" };

        var alerts = SnmpDeviceReader.BuildCoverAlerts(statuses, descriptions, CoverStatusTable, CoverDescriptionTable);

        var alert = Assert.Single(alerts!);
        Assert.Equal("COVER_OPEN", alert.Code);
        Assert.Equal("Front Door", alert.Description);
        Assert.Equal("warning", alert.Severity);
    }

    [Fact]
    public void BuildCoverAlerts_interlock_aberto_usa_codigo_proprio()
    {
        var statuses = new Dictionary<string, string> { [$"{CoverStatusTable}.1"] = "5" }; // interlockOpen

        var alerts = SnmpDeviceReader.BuildCoverAlerts(statuses, new Dictionary<string, string>(), CoverStatusTable, CoverDescriptionTable);

        Assert.Equal("COVER_INTERLOCK_OPEN", Assert.Single(alerts!).Code);
    }

    [Theory]
    [InlineData(1)] // other
    [InlineData(4)] // coverClosed
    public void BuildCoverAlerts_capa_fechada_ou_other_nao_gera_alerta(int statusValue)
    {
        var statuses = new Dictionary<string, string> { [$"{CoverStatusTable}.1"] = statusValue.ToString() };

        var alerts = SnmpDeviceReader.BuildCoverAlerts(statuses, new Dictionary<string, string>(), CoverStatusTable, CoverDescriptionTable);

        Assert.Null(alerts);
    }

    [Fact]
    public void BuildCoverAlerts_todas_fechadas_retorna_null_nao_lista_vazia()
    {
        var statuses = new Dictionary<string, string>
        {
            [$"{CoverStatusTable}.1"] = "4",
            [$"{CoverStatusTable}.2"] = "4",
        };

        var alerts = SnmpDeviceReader.BuildCoverAlerts(statuses, new Dictionary<string, string>(), CoverStatusTable, CoverDescriptionTable);

        Assert.Null(alerts);
    }
}
