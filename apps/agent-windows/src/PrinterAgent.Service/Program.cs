using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PrinterAgent.Core.Api;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Discovery;
using PrinterAgent.Core.Discovery.Dns;
using PrinterAgent.Core.Discovery.Ipp;
using PrinterAgent.Core.Queue;
using PrinterAgent.Core.Snmp;
using PrinterAgent.Core.Update;
using PrinterAgent.Service;
using Serilog;

// Must happen before any discovery sweep — see ThreadPoolWarmup's own doc
// comment for why a cold ThreadPool made scans look frozen.
PrinterAgent.Core.Discovery.ThreadPoolWarmup.EnsureMinThreads(expectedConcurrency: 16);

var logDirectory = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
    "PrinterSaaS", "Agent", "Logs");
Directory.CreateDirectory(logDirectory);

// Rotating logs per spec §41 — one file per day, capped retention, never
// logs secrets (tokens/community strings/passwords are never passed to
// ILogger anywhere in this codebase — see PrinterSaasApiClient/SnmpDeviceReader).
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.File(
        Path.Combine(logDirectory, "agent-.log"),
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 14,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}")
    .WriteTo.Console()
    .CreateLogger();

try
{
    var builder = Host.CreateApplicationBuilder(args);

    builder.Services.AddSerilog();
    builder.Services.AddWindowsService(options => options.ServiceName = "PrinterSaaSAgent");

    builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection(AgentOptions.SectionName));

    builder.Services.AddSingleton<AgentCredentialStore>();
    builder.Services.AddSingleton<AgentProxyStore>();
    builder.Services.AddSingleton<AgentEnrollmentService>();
    builder.Services.AddSingleton<OfflineQueue>();
    
    // SNMP v3 support - conditionally enabled: appsettings.json always ships an
    // "SnmpV3" section (even when empty), so options.SnmpV3 is never null here —
    // the real signal is whether UserName was actually filled in. Constructing
    // SnmpV3Credentials with an empty UserName throws (by design, so a genuinely
    // misconfigured v3 setup fails loud), which used to crash this singleton
    // factory at first resolution even with v3 left unconfigured. Guarded the
    // same way PrinterAgent.ConfigTool/AgentContext.TryCreateV3Credentials does.
    //
    // SnmpV3CredentialStore wraps whatever local fallback this produces —
    // it's overridden per-printer/tenant-wide-default by AgentWorker as soon
    // as the Agent successfully polls GET /agent-api/v1/config (see
    // RefreshRemoteConfigAsync), so this local appsettings.json credential
    // only matters before that first successful poll, or if the server has
    // nothing configured for this Agent at all.
    builder.Services.AddSingleton<SnmpV3EngineDiscovery>();
    builder.Services.AddSingleton<SnmpV3CredentialStore>(sp =>
    {
        var options = sp.GetRequiredService<IOptions<AgentOptions>>().Value;
        if (string.IsNullOrWhiteSpace(options.SnmpV3?.UserName))
        {
            return new SnmpV3CredentialStore(null);
        }
        try
        {
            return new SnmpV3CredentialStore(new SnmpV3Credentials(options.SnmpV3));
        }
        catch (Exception ex)
        {
            sp.GetRequiredService<ILogger<SnmpV3CredentialStore>>()
                .LogWarning(ex, "SNMP v3 is configured but invalid — falling back to v1/v2c only.");
            return new SnmpV3CredentialStore(null);
        }
    });
    builder.Services.AddSingleton<SnmpDeviceReader>(sp =>
    {
        var logger = sp.GetRequiredService<ILogger<SnmpDeviceReader>>();
        var v3CredentialStore = sp.GetRequiredService<SnmpV3CredentialStore>();
        var v3EngineDiscovery = sp.GetRequiredService<SnmpV3EngineDiscovery>();
        return new SnmpDeviceReader(logger, v3CredentialStore, v3EngineDiscovery);
    });
    
    builder.Services.AddSingleton<ModelDatabase>();
    builder.Services.AddSingleton<MdnsProbe>();
    builder.Services.AddSingleton<DeviceProbeOrchestrator>();
    builder.Services.AddSingleton<PrinterDiscoveryService>();
    builder.Services.AddSingleton<AgentUpdateChecker>();

    // Own short-timeout HttpClient — IPP probes must never share the
    // 30s-timeout, proxy-routed client used for talking to the SaaS API.
    builder.Services.AddHttpClient<IppClient>(http => http.Timeout = TimeSpan.FromSeconds(5));

    builder.Services.AddHttpClient<PrinterSaasApiClient>((sp, http) =>
        {
            var apiUrl = builder.Configuration.GetSection(AgentOptions.SectionName)["ApiUrl"] ?? "http://localhost:3001";
            http.BaseAddress = new Uri(apiUrl.TrimEnd('/') + "/");
            http.Timeout = TimeSpan.FromSeconds(30);
        })
        // Proxy settings (if any) are read once at service start — same rule as
        // changing ApiUrl: applying a new proxy configuration requires a service
        // restart (see AgentProxyStore / ConfigTool Configurações tab).
        .ConfigurePrimaryHttpMessageHandler(sp =>
        {
            var proxy = sp.GetRequiredService<AgentProxyStore>().Load();
            var handler = new HttpClientHandler();
            if (proxy is { IsConfigured: true })
            {
                handler.Proxy = new System.Net.WebProxy(proxy.Server!, proxy.Port!.Value)
                {
                    Credentials = string.IsNullOrWhiteSpace(proxy.Username)
                        ? null
                        : new System.Net.NetworkCredential(proxy.Username, proxy.Password, proxy.Domain),
                };
                handler.UseProxy = true;
            }
            return handler;
        });

    builder.Services.AddHostedService<AgentWorker>();

    var host = builder.Build();
    host.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "PrinterSaaS Agent terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
