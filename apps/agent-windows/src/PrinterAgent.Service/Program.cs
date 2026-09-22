using PrinterAgent.Core.Api;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Discovery;
using PrinterAgent.Core.Discovery.Dns;
using PrinterAgent.Core.Discovery.Ipp;
using PrinterAgent.Core.Queue;
using PrinterAgent.Core.Snmp;
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
    builder.Services.AddSingleton<SnmpDeviceReader>();
    builder.Services.AddSingleton<ModelDatabase>();
    builder.Services.AddSingleton<MdnsProbe>();
    builder.Services.AddSingleton<DeviceProbeOrchestrator>();
    builder.Services.AddSingleton<PrinterDiscoveryService>();

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
