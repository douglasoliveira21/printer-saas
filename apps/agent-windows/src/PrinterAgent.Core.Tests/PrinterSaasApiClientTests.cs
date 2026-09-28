using System.Diagnostics;
using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using PrinterAgent.Core.Api;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Models;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Simula respostas HTTP sem tocar rede de verdade — cobre os cenários da
/// Fase 5 (API rápida / lenta / indisponível / cancelamento) sem depender
/// de um servidor real.
/// </summary>
internal sealed class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _respond;

    public FakeHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond) => _respond = respond;

    public static FakeHttpMessageHandler Immediate(HttpStatusCode status, string json = "{}") =>
        new((_, _) => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(json) }));

    /// <summary>Never actually responds within any reasonable test timeout — the caller's own cancellation (via CancelAfter) is what ends the wait, exactly like a real hung connection.</summary>
    public static FakeHttpMessageHandler NeverResponds() =>
        new(async (_, ct) =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            throw new InvalidOperationException("unreachable — Task.Delay(Infinite) only returns via cancellation");
        });

    /// <summary>Responds successfully, but only after `delay` — used to prove a call that should NOT be cut short by a shorter per-call timeout still succeeds.</summary>
    public static FakeHttpMessageHandler DelayedThenOk(TimeSpan delay) =>
        new(async (_, ct) =>
        {
            await Task.Delay(delay, ct);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") };
        });

    public static FakeHttpMessageHandler Unavailable() =>
        new((_, _) => throw new HttpRequestException("connection refused")); // also representative of DNS failure — same exception type reaches the caller either way

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
        _respond(request, cancellationToken);
}

public class PrinterSaasApiClientTests
{
    private static PrinterSaasApiClient CreateClient(HttpMessageHandler handler, TimeSpan? clientTimeout = null)
    {
        var http = new HttpClient(handler) { BaseAddress = new Uri("http://fake-api.invalid/"), Timeout = clientTimeout ?? TimeSpan.FromSeconds(30) };
        var credentialStore = new AgentCredentialStore(NullLogger<AgentCredentialStore>.Instance);
        return new PrinterSaasApiClient(http, credentialStore, NullLogger<PrinterSaasApiClient>.Instance);
    }

    [Fact]
    public async Task Heartbeat_API_rapida_retorna_true()
    {
        var client = CreateClient(FakeHttpMessageHandler.Immediate(HttpStatusCode.OK));

        var result = await client.HeartbeatAsync(new HeartbeatRequest(), CancellationToken.None);

        Assert.True(result);
    }

    [Fact]
    public async Task Heartbeat_API_lenta_alem_do_timeout_curto_falha_rapido_sem_esperar_os_30s_do_cliente()
    {
        var client = CreateClient(FakeHttpMessageHandler.NeverResponds());
        var sw = Stopwatch.StartNew();

        var result = await client.HeartbeatAsync(new HeartbeatRequest(), CancellationToken.None);

        sw.Stop();
        Assert.False(result);
        // HeartbeatTimeout interno é 10s — folga generosa até 20s pra não
        // dar falso negativo em máquina lenta, mas bem abaixo dos 30s do
        // HttpClient.Timeout, provando que o corte curto realmente atuou.
        Assert.True(sw.Elapsed < TimeSpan.FromSeconds(20), $"Levou {sw.Elapsed} — deveria ter cortado bem antes dos 30s do cliente");
    }

    [Fact]
    public async Task Heartbeat_API_indisponivel_retorna_false_sem_lancar_excecao()
    {
        var client = CreateClient(FakeHttpMessageHandler.Unavailable());

        var result = await client.HeartbeatAsync(new HeartbeatRequest(), CancellationToken.None);

        Assert.False(result);
    }

    [Fact]
    public async Task Heartbeat_cancelamento_externo_retorna_false_sem_lancar_excecao()
    {
        var client = CreateClient(FakeHttpMessageHandler.NeverResponds());
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        var result = await client.HeartbeatAsync(new HeartbeatRequest(), cts.Token);

        Assert.False(result);
    }

    [Fact]
    public async Task GetConfig_API_rapida_retorna_config()
    {
        var client = CreateClient(FakeHttpMessageHandler.Immediate(HttpStatusCode.OK, "{}"));

        var result = await client.GetConfigAsync(CancellationToken.None);

        Assert.NotNull(result);
    }

    [Fact]
    public async Task GetConfig_API_lenta_alem_do_timeout_curto_falha_rapido()
    {
        var client = CreateClient(FakeHttpMessageHandler.NeverResponds());
        var sw = Stopwatch.StartNew();

        var result = await client.GetConfigAsync(CancellationToken.None);

        sw.Stop();
        Assert.Null(result);
        Assert.True(sw.Elapsed < TimeSpan.FromSeconds(20));
    }

    [Fact]
    public async Task GetConfig_API_indisponivel_retorna_null_sem_lancar_excecao()
    {
        var client = CreateClient(FakeHttpMessageHandler.Unavailable());

        var result = await client.GetConfigAsync(CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task SubmitDevices_nao_usa_o_timeout_curto_do_Heartbeat_uma_resposta_de_12s_ainda_tem_sucesso()
    {
        // 12s > HeartbeatTimeout (10s), mas bem dentro do Timeout de 30s do
        // HttpClient — prova que SubmitDevices continua com o teto maior,
        // sem herdar o corte curto do Heartbeat/GetConfig.
        var client = CreateClient(FakeHttpMessageHandler.DelayedThenOk(TimeSpan.FromSeconds(12)));

        var result = await client.SubmitDevicesAsync(new SubmitDevicesRequest { Devices = [] }, CancellationToken.None);

        Assert.True(result);
    }

    [Fact]
    public async Task SubmitDevices_API_indisponivel_retorna_false_sem_lancar_excecao_para_a_OfflineQueue_enfileirar()
    {
        var client = CreateClient(FakeHttpMessageHandler.Unavailable());

        var result = await client.SubmitDevicesAsync(new SubmitDevicesRequest { Devices = [] }, CancellationToken.None);

        Assert.False(result);
    }
}
