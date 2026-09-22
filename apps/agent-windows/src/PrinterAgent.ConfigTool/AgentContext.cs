using System.Net;
using System.Net.Http;
using Microsoft.Extensions.Logging.Abstractions;
using PrinterAgent.Core.Api;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Discovery;
using PrinterAgent.Core.Discovery.Dns;
using PrinterAgent.Core.Discovery.Ipp;
using PrinterAgent.Core.Snmp;

namespace PrinterAgent.ConfigTool;

/// <summary>
/// Shared dependencies for the tabbed screens (Impressoras/Ferramentas/
/// Configurações) — constructed once by MainWindow and passed down, mirroring
/// what Program.cs wires up via DI for the headless Service, but built by
/// hand here since the ConfigTool is a small WPF app without its own
/// dependency-injection host (same reasoning as WindowsServiceInstaller
/// already being `new`'d directly in MainWindow).
/// </summary>
public class AgentContext
{
    public WindowsServiceInstaller Installer { get; }
    public AgentCredentialStore CredentialStore { get; }
    public AgentProxyStore ProxyStore { get; }
    public SnmpDeviceReader SnmpReader { get; }
    public PrinterDiscoveryService DiscoveryService { get; }
    public PrinterSaasApiClient ApiClient { get; private set; }

    public AgentContext(WindowsServiceInstaller installer)
    {
        Installer = installer;
        CredentialStore = new AgentCredentialStore(NullLogger<AgentCredentialStore>.Instance);
        ProxyStore = new AgentProxyStore(NullLogger<AgentProxyStore>.Instance);
        SnmpReader = new SnmpDeviceReader(NullLogger<SnmpDeviceReader>.Instance);

        var ippClient = new IppClient(new HttpClient { Timeout = TimeSpan.FromSeconds(5) }, NullLogger<IppClient>.Instance);
        var modelDatabase = new ModelDatabase(NullLogger<ModelDatabase>.Instance);
        var orchestrator = new DeviceProbeOrchestrator(SnmpReader, ippClient, modelDatabase, NullLogger<DeviceProbeOrchestrator>.Instance);
        var mdnsProbe = new MdnsProbe(NullLogger<MdnsProbe>.Instance);
        DiscoveryService = new PrinterDiscoveryService(orchestrator, mdnsProbe, NullLogger<PrinterDiscoveryService>.Instance);

        ApiClient = BuildApiClient();
    }

    /// <summary>Rebuilds the HTTP client/handler — call after saving proxy settings so "Testar comunicação" and subsequent calls pick up the new values without restarting the ConfigTool.</summary>
    public void RefreshApiClient()
    {
        ApiClient = BuildApiClient();
    }

    private PrinterSaasApiClient BuildApiClient()
    {
        var apiUrl = Installer.GetConfiguredApiUrl() ?? WindowsServiceInstaller.DefaultApiUrl;
        var handler = new HttpClientHandler();
        var proxy = ProxyStore.Load();
        if (proxy is { IsConfigured: true })
        {
            handler.Proxy = new WebProxy(proxy.Server!, proxy.Port!.Value)
            {
                Credentials = string.IsNullOrWhiteSpace(proxy.Username)
                    ? null
                    : new NetworkCredential(proxy.Username, proxy.Password, proxy.Domain),
            };
            handler.UseProxy = true;
        }
        var http = new HttpClient(handler) { BaseAddress = new Uri(apiUrl.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(15) };
        return new PrinterSaasApiClient(http, CredentialStore, NullLogger<PrinterSaasApiClient>.Instance);
    }
}
