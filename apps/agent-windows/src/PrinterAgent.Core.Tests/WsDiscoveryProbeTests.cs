using System.Text;
using PrinterAgent.Core.Discovery.Dns;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Fase 12 (WS-Discovery). The exact SOAP envelope shape and namespaces
/// asserted here are copied from Microsoft's own WSDAPI documentation
/// (Probe Message / ProbeMatches Message — the real wire format WSD-capable
/// printers and Windows hosts implement), not reconstructed from memory —
/// see WsDiscoveryProbe.cs's own doc comment for the sourced links.
/// </summary>
public class WsDiscoveryProbeTests
{
    [Fact]
    public void BuildProbe_usa_o_action_e_namespace_corretos_do_WS_Discovery_2005()
    {
        var xml = Encoding.UTF8.GetString(WsDiscoveryProbe.BuildProbe());

        Assert.Contains("urn:schemas-xmlsoap-org:ws:2005:04:discovery", xml);
        Assert.Contains("http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe", xml);
        Assert.Contains("wsdp:Device", xml);
    }

    [Fact]
    public void BuildProbe_gera_um_MessageID_novo_a_cada_chamada()
    {
        var first = Encoding.UTF8.GetString(WsDiscoveryProbe.BuildProbe());
        var second = Encoding.UTF8.GetString(WsDiscoveryProbe.BuildProbe());

        Assert.NotEqual(first, second);
    }

    [Fact]
    public void TryParseProbeMatchTypes_extrai_os_tokens_de_Types_de_uma_resposta_real()
    {
        // Exemplo verbatim da documentação da Microsoft (ProbeMatches
        // Message), adaptado só para incluir um token de impressora junto
        // do genérico wsdp:Device — confirma que ambos são extraídos, sem
        // decidir aqui se algum deles "conta" como evidência (isso é
        // responsabilidade do DeviceClassifier).
        var xml = """
            <?xml version="1.0" encoding="utf-8" ?>
            <soap:Envelope
                xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
                xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
                xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"
                xmlns:wsdp="http://schemas.xmlsoap.org/ws/2006/02/devprof"
                xmlns:print="http://schemas.microsoft.com/windows/2006/08/wdp/print">
            <soap:Header>
                <wsa:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>
                <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>
                <wsa:MessageID>urn:uuid:967d0036-fe69-40ad-8191-dd1fc8ef64ab</wsa:MessageID>
                <wsa:RelatesTo>urn:uuid:29cf10da-5c41-4d55-b184-5ee15e38ce23</wsa:RelatesTo>
            </soap:Header>
            <soap:Body>
                <wsd:ProbeMatches>
                    <wsd:ProbeMatch>
                        <wsa:EndpointReference>
                            <wsa:Address>urn:uuid:37f86d35-e6ac-4241-964f-1d9ae46fb366</wsa:Address>
                        </wsa:EndpointReference>
                        <wsd:Types>wsdp:Device print:PrintDeviceType</wsd:Types>
                        <wsd:XAddrs>http://192.168.0.2:5357/37f86d35-e6ac-4241-964f-1d9ae46fb366</wsd:XAddrs>
                        <wsd:MetadataVersion>2</wsd:MetadataVersion>
                    </wsd:ProbeMatch>
                </wsd:ProbeMatches>
            </soap:Body>
            </soap:Envelope>
            """;

        var types = WsDiscoveryProbe.TryParseProbeMatchTypes(Encoding.UTF8.GetBytes(xml));

        Assert.Equal(["wsdp:Device", "print:PrintDeviceType"], types);
    }

    [Fact]
    public void TryParseProbeMatchTypes_pacote_nao_relacionado_ou_malformado_retorna_lista_vazia()
    {
        var types = WsDiscoveryProbe.TryParseProbeMatchTypes(Encoding.UTF8.GetBytes("not xml at all"));

        Assert.Empty(types);
    }

    [Fact]
    public void TryParseProbeMatchTypes_resposta_sem_ProbeMatch_retorna_lista_vazia()
    {
        // Ex.: um Hello/Bye ou qualquer outra mensagem WS-Discovery que não
        // é uma ProbeMatches — não deve gerar falso positivo por acidente
        // de parsing.
        var xml = """
            <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery">
              <soap:Body><wsd:Bye /></soap:Body>
            </soap:Envelope>
            """;

        var types = WsDiscoveryProbe.TryParseProbeMatchTypes(Encoding.UTF8.GetBytes(xml));

        Assert.Empty(types);
    }
}
