using PrinterAgent.Core.Api;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Discovery;
using PrinterAgent.Core.Queue;
using PrinterAgent.Core.Snmp;
using PrinterAgent.Service;
using Serilog;

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
    builder.Services.AddSingleton<AgentEnrollmentService>();
    builder.Services.AddSingleton<OfflineQueue>();
    builder.Services.AddSingleton<SnmpDeviceReader>();
    builder.Services.AddSingleton<PrinterDiscoveryService>();

    builder.Services.AddHttpClient<PrinterSaasApiClient>((sp, http) =>
    {
        var apiUrl = builder.Configuration.GetSection(AgentOptions.SectionName)["ApiUrl"] ?? "http://localhost:3001";
        http.BaseAddress = new Uri(apiUrl.TrimEnd('/') + "/");
        http.Timeout = TimeSpan.FromSeconds(30);
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
