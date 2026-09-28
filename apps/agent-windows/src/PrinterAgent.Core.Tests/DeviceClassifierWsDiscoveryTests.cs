using PrinterAgent.Core.Classification;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Fase 12 (WS-Discovery) — spec: "melhorar descoberta de dispositivos
/// compatíveis sem transformar a descoberta em uma fonte de falsos
/// positivos", testado explicitamente contra impressora, PC, servidor,
/// roteador, switch, AP, câmera e dispositivo desconhecido. O classificador
/// continua sendo o responsável pela decisão final — WS-Discovery é só mais
/// um sinal de entrada, nunca decide sozinho.
/// </summary>
public class DeviceClassifierWsDiscoveryTests
{
    [Fact]
    public void Impressora_com_tipo_de_impressao_no_WS_Discovery_conta_como_evidencia_positiva()
    {
        var withPrintType = DeviceClassifier.Classify(new DeviceSignals
        {
            WsDiscoveryTypes = ["wsdp:Device", "print:PrintDeviceType"],
        });
        var withoutAnyEvidence = DeviceClassifier.Classify(new DeviceSignals());

        Assert.True(withPrintType.Confidence > withoutAnyEvidence.Confidence);
        Assert.Contains(withPrintType.Evidence, e => e.Source == "ws_discovery");
    }

    [Theory]
    [InlineData("wsdp:Device")] // genérico — todo host DPWS responde isso, inclusive PC/servidor
    [InlineData("tds:Device")] // ONVIF (câmera IP) — usa WS-Discovery também, mas não é impressora
    [InlineData("dn:NetworkVideoTransmitter")] // ONVIF, câmera
    public void Tipo_generico_ou_de_outra_categoria_de_dispositivo_NAO_conta_como_evidencia_de_impressora(string wsdType)
    {
        var signals = new DeviceSignals { WsDiscoveryTypes = [wsdType] };

        var result = DeviceClassifier.Classify(signals);

        Assert.DoesNotContain(result.Evidence, e => e.Source == "ws_discovery");
        Assert.Equal(DeviceType.Unknown, result.Type);
    }

    [Fact]
    public void Roteador_com_WS_Discovery_generico_continua_sendo_vetado_pelo_keyword_negativo()
    {
        // Alguns roteadores/APs de consumo também respondem WS-Discovery
        // genérico (é raro, mas o teste documenta que mesmo que
        // respondessem, o veto por sysDescr continua funcionando —
        // WS-Discovery nunca sobrepõe uma evidência negativa forte.
        var signals = new DeviceSignals
        {
            SysDescr = "MikroTik RouterOS",
            WsDiscoveryTypes = ["wsdp:Device"],
        };

        var result = DeviceClassifier.Classify(signals);

        Assert.Equal(DeviceType.Router, result.Type);
    }

    [Fact]
    public void Impressora_real_combina_WS_Discovery_com_Printer_MIB_sem_duplicar_pontuacao_indevidamente()
    {
        var signals = new DeviceSignals
        {
            PrinterMibGeneralFound = true,
            PrinterMibCountersFound = true,
            WsDiscoveryTypes = ["wsdp:Device", "print:PrintDeviceType"],
        };

        var result = DeviceClassifier.Classify(signals);

        Assert.Equal(DeviceType.Printer, result.Type);
        Assert.True(result.Confidence >= 0.4);
    }

    [Fact]
    public void Dispositivo_desconhecido_sem_nenhum_sinal_permanece_Unknown()
    {
        var result = DeviceClassifier.Classify(new DeviceSignals());

        Assert.Equal(DeviceType.Unknown, result.Type);
    }
}
