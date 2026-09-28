using PrinterAgent.Core.Classification;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Fase 14 (testes finais) — suíte de Discovery/classificação cobrindo
/// exatamente as categorias listadas na especificação da fase: impressora,
/// roteador, switch, firewall, câmera, dispositivo desconhecido (AP e
/// servidor incluídos também, já que o classificador os trata da mesma
/// forma). Complementa (não duplica) DeviceClassifierWsDiscoveryTests, que
/// já cobre a interação específica do sinal de WS-Discovery.
/// </summary>
public class DeviceClassifierTests
{
    [Fact]
    public void Impressora_real_com_evidencia_forte_de_multiplas_fontes_e_classificada_como_Printer()
    {
        var signals = new DeviceSignals
        {
            SysDescr = "HP LaserJet P1102w; Firmware 20210101",
            PrinterMibGeneralFound = true,
            PrinterMibCountersFound = true,
            PrinterMibSuppliesFound = true,
            OpenTcpPorts = [9100],
            OuiIsKnownPrinterVendor = true,
        };

        var result = DeviceClassifier.Classify(signals);

        Assert.Equal(DeviceType.Printer, result.Type);
        Assert.True(result.Confidence >= 0.4);
        Assert.NotEmpty(result.Evidence);
    }

    [Fact]
    public void Impressora_so_com_IPP_respondendo_ainda_e_classificada_como_Printer()
    {
        var signals = new DeviceSignals { Ipp = new IppProbeResult { Responded = true } };

        var result = DeviceClassifier.Classify(signals);

        Assert.Equal(DeviceType.Printer, result.Type);
    }

    [Theory]
    [InlineData("Cisco IOS Software, Catalyst 2960 Switch", DeviceType.Switch)]
    [InlineData("MikroTik RouterOS", DeviceType.Router)]
    [InlineData("pfSense Firewall", DeviceType.Firewall)]
    [InlineData("Fortinet FortiGate Firewall", DeviceType.Firewall)]
    [InlineData("Ubiquiti UniFi Access Point", DeviceType.AccessPoint)]
    [InlineData("Axis Network Camera", DeviceType.Camera)]
    [InlineData("VMware ESXi Server", DeviceType.Server)]
    public void Dispositivo_de_infraestrutura_e_reconhecido_pelo_sysDescr_e_vetado_como_impressora(string sysDescr, DeviceType expectedType)
    {
        // Mesmo com porta 9100 aberta (sinal fraco de impressora) — o veto
        // por palavra-chave em sysDescr tem prioridade sobre qualquer
        // evidência circunstancial positiva (spec: "impressora não pode
        // virar roteador/switch/câmera por coincidência de porta aberta").
        var signals = new DeviceSignals { SysDescr = sysDescr, OpenTcpPorts = [9100] };

        var result = DeviceClassifier.Classify(signals);

        Assert.Equal(expectedType, result.Type);
        Assert.Contains(result.Evidence, e => e.IsNegative);
    }

    [Fact]
    public void Dispositivo_completamente_desconhecido_sem_nenhum_sinal_fica_Unknown()
    {
        var result = DeviceClassifier.Classify(new DeviceSignals());

        Assert.Equal(DeviceType.Unknown, result.Type);
        Assert.Equal(0, result.Confidence);
    }

    [Fact]
    public void PC_generico_respondendo_so_a_porta_aberta_fraca_nao_vira_impressora()
    {
        // Um único sinal fraco (OUI de fabricante de impressora) nunca é
        // suficiente sozinho — precisa de pelo menos uma evidência "forte"
        // (hasStrongPositive) pra virar Printer.
        var signals = new DeviceSignals { OuiIsKnownPrinterVendor = true };

        var result = DeviceClassifier.Classify(signals);

        Assert.Equal(DeviceType.Unknown, result.Type);
    }

    [Fact]
    public void OUI_de_fabricante_de_rede_reduz_a_pontuacao_mesmo_com_algum_sinal_de_impressora()
    {
        var withInfraOui = DeviceClassifier.Classify(new DeviceSignals
        {
            PrinterMibSuppliesFound = true, // sinal fraco isolado (0.2), não é "forte" sozinho
            OuiIsKnownInfraVendor = true,
        });

        Assert.Equal(DeviceType.Unknown, withInfraOui.Type);
        Assert.Contains(withInfraOui.Evidence, e => e.IsNegative && e.Source == "oui");
    }

    [Fact]
    public void Confianca_nunca_ultrapassa_1_0_mesmo_somando_todas_as_evidencias_positivas()
    {
        var signals = new DeviceSignals
        {
            SysDescr = "HP LaserJet",
            PrinterMibGeneralFound = true,
            PrinterMibCountersFound = true,
            PrinterMibSuppliesFound = true,
            Ipp = new IppProbeResult { Responded = true },
            OpenTcpPorts = [9100],
            MdnsServices = ["_ipp._tcp.local"],
            WsDiscoveryTypes = ["print:PrintDeviceType"],
            OuiIsKnownPrinterVendor = true,
        };

        var result = DeviceClassifier.Classify(signals);

        Assert.True(result.Confidence <= 1.0);
    }
}
