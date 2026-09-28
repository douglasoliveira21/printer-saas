using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Discovery;
using PrinterAgent.Core.Discovery.Dns;
using PrinterAgent.Core.Discovery.Ipp;
using PrinterAgent.Core.Snmp;
using PrinterAgent.Core.Vendors;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>Fase 7 (validação de Network Range) — a rejeição precisa acontecer ANTES de qualquer varredura real, então essas dependências nunca chegam a ser usadas de verdade.</summary>
public class PrinterDiscoveryServiceTests
{
    private static PrinterDiscoveryService CreateService()
    {
        var snmpReader = new SnmpDeviceReader(NullLogger<SnmpDeviceReader>.Instance);
        var ippClient = new IppClient(new HttpClient(), NullLogger<IppClient>.Instance);
        var samsungCountersClient = new SamsungCountersClient(new HttpClient(), NullLogger<SamsungCountersClient>.Instance);
        var modelDatabase = new ModelDatabase(NullLogger<ModelDatabase>.Instance);
        var orchestrator = new DeviceProbeOrchestrator(snmpReader, ippClient, modelDatabase, samsungCountersClient, NullLogger<DeviceProbeOrchestrator>.Instance);
        var mdnsProbe = new MdnsProbe(NullLogger<MdnsProbe>.Instance);
        var wsDiscoveryProbe = new WsDiscoveryProbe(NullLogger<WsDiscoveryProbe>.Instance);
        return new PrinterDiscoveryService(orchestrator, mdnsProbe, wsDiscoveryProbe, NullLogger<PrinterDiscoveryService>.Instance);
    }

    [Fact]
    public async Task Rede_acima_do_limite_configurado_aborta_com_mensagem_clara_em_vez_de_iniciar_a_varredura()
    {
        var service = CreateService();
        var options = new AgentOptions { Networks = ["10.0.0.0/16"], MaximumDiscoveryHosts = 8192 };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.ScanAsync(options, CancellationToken.None));

        Assert.Contains("65534", ex.Message); // quantidade estimada
        Assert.Contains("8192", ex.Message); // limite configurado
    }

    [Fact]
    public async Task Rede_dentro_do_limite_nao_lanca_por_causa_da_validacao()
    {
        // Usa um alvo sem nenhum host de verdade (documentação/teste,
        // 203.0.113.0/24 é reservado pra isso) — o objetivo aqui é só
        // confirmar que a validação de TAMANHO não bloqueia, não que a
        // varredura em si encontre algo (isso já é coberto pelo isolamento
        // por host testado nas fases anteriores).
        var service = CreateService();
        var options = new AgentOptions { Networks = ["203.0.113.0/30"], MaximumDiscoveryHosts = 8192, SnmpTimeoutMs = 200, SnmpRetries = 0 };
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

        var result = await service.ScanAsync(options, cts.Token);

        Assert.NotNull(result); // não lançou InvalidOperationException de validação
    }

    [Fact]
    public async Task Varias_redes_pequenas_somadas_acima_do_limite_tambem_abortam()
    {
        var service = CreateService();
        var options = new AgentOptions { Networks = ["10.0.0.0/24", "10.0.1.0/24"], MaximumDiscoveryHosts = 300 };

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ScanAsync(options, CancellationToken.None));
    }

    [Fact]
    public async Task Fase8_ciclo_de_varredura_loga_um_resumo_estruturado_com_as_metricas_do_ciclo()
    {
        var snmpReader = new SnmpDeviceReader(NullLogger<SnmpDeviceReader>.Instance);
        var ippClient = new IppClient(new HttpClient(), NullLogger<IppClient>.Instance);
        var samsungCountersClient = new SamsungCountersClient(new HttpClient(), NullLogger<SamsungCountersClient>.Instance);
        var modelDatabase = new ModelDatabase(NullLogger<ModelDatabase>.Instance);
        var orchestrator = new DeviceProbeOrchestrator(snmpReader, ippClient, modelDatabase, samsungCountersClient, NullLogger<DeviceProbeOrchestrator>.Instance);
        var mdnsProbe = new MdnsProbe(NullLogger<MdnsProbe>.Instance);
        var wsDiscoveryProbe = new WsDiscoveryProbe(NullLogger<WsDiscoveryProbe>.Instance);
        var capturingLogger = new CapturingLogger<PrinterDiscoveryService>();
        var service = new PrinterDiscoveryService(orchestrator, mdnsProbe, wsDiscoveryProbe, capturingLogger);
        // 2 hosts, faixa documental (RFC 5737) — nenhum responde de verdade.
        var options = new AgentOptions { Networks = ["203.0.113.0/30"], MaximumDiscoveryHosts = 8192, SnmpTimeoutMs = 200, SnmpRetries = 0 };
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

        await service.ScanAsync(options, cts.Token);

        var summary = capturingLogger.Messages.FirstOrDefault(m => m.StartsWith("Discovery complete:"));
        Assert.NotNull(summary);
        Assert.Contains("hosts_examined=2", summary);
        Assert.Contains("devices_found=0", summary);
        Assert.Contains("snmp_failure=2", summary); // nada responde nessa faixa documental
        Assert.Contains("scan_duration=", summary);
    }

    [Fact]
    public async Task Fase10_CollectAsync_com_lista_vazia_nao_faz_nenhuma_sondagem_e_retorna_rapido()
    {
        var service = CreateService();
        var options = new AgentOptions { MaximumDiscoveryHosts = 8192 };

        var result = await service.CollectAsync([], options, CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Fase10_CollectAsync_reproba_so_os_IPs_informados_sem_expandir_nenhuma_rede()
    {
        var snmpReader = new SnmpDeviceReader(NullLogger<SnmpDeviceReader>.Instance);
        var ippClient = new IppClient(new HttpClient(), NullLogger<IppClient>.Instance);
        var samsungCountersClient = new SamsungCountersClient(new HttpClient(), NullLogger<SamsungCountersClient>.Instance);
        var modelDatabase = new ModelDatabase(NullLogger<ModelDatabase>.Instance);
        var orchestrator = new DeviceProbeOrchestrator(snmpReader, ippClient, modelDatabase, samsungCountersClient, NullLogger<DeviceProbeOrchestrator>.Instance);
        var mdnsProbe = new MdnsProbe(NullLogger<MdnsProbe>.Instance);
        var wsDiscoveryProbe = new WsDiscoveryProbe(NullLogger<WsDiscoveryProbe>.Instance);
        var capturingLogger = new CapturingLogger<PrinterDiscoveryService>();
        var service = new PrinterDiscoveryService(orchestrator, mdnsProbe, wsDiscoveryProbe, capturingLogger);
        // Só 2 IPs específicos (faixa documental RFC 5737) — nunca uma rede
        // inteira. Se isso algum dia voltasse a expandir uma rede, o
        // hosts_examined abaixo estouraria de 2 pra muito mais.
        var knownIps = new List<IPAddress> { IPAddress.Parse("203.0.113.5"), IPAddress.Parse("203.0.113.6") };
        var options = new AgentOptions { MaximumDiscoveryHosts = 8192, SnmpTimeoutMs = 200, SnmpRetries = 0 };
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

        await service.CollectAsync(knownIps, options, cts.Token);

        var summary = capturingLogger.Messages.FirstOrDefault(m => m.StartsWith("Collection complete:"));
        Assert.NotNull(summary);
        Assert.Contains("hosts_examined=2", summary);
    }
}
