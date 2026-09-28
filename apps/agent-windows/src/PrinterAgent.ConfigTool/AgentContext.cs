using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
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
        // Same reasoning as the Service's Program.cs — a manual "Buscar
        // agora" from the ConfigTool runs the exact same concurrent SNMP
        // discovery and needs the ThreadPool warmed up the same way.
        ThreadPoolWarmup.EnsureMinThreads(expectedConcurrency: 16);

        Installer = installer;
        CredentialStore = new AgentCredentialStore(NullLogger<AgentCredentialStore>.Instance);
        ProxyStore = new AgentProxyStore(NullLogger<AgentProxyStore>.Instance);
        
        // SNMP v3 support - conditionally initialize if configured locally.
        // The ConfigTool never polls GET /agent-api/v1/config itself (that's
        // the Service's job), so a manual "Buscar agora" here only ever sees
        // the local appsettings.json fallback, never per-printer overrides
        // from the web app — same limitation as SnmpCommunity/Networks,
        // which are also Service-refreshed only.
        var v3Credentials = TryCreateV3Credentials();
        var v3EngineDiscovery = v3Credentials is not null ? new SnmpV3EngineDiscovery(NullLogger<SnmpV3EngineDiscovery>.Instance) : null;
        var v3CredentialStore = new SnmpV3CredentialStore(v3Credentials);
        SnmpReader = new SnmpDeviceReader(NullLogger<SnmpDeviceReader>.Instance, v3CredentialStore, v3EngineDiscovery);

        var ippClient = new IppClient(new HttpClient { Timeout = TimeSpan.FromSeconds(5) }, NullLogger<IppClient>.Instance);
        var modelDatabase = new ModelDatabase(NullLogger<ModelDatabase>.Instance);
        var orchestrator = new DeviceProbeOrchestrator(SnmpReader, ippClient, modelDatabase, NullLogger<DeviceProbeOrchestrator>.Instance);
        var mdnsProbe = new MdnsProbe(NullLogger<MdnsProbe>.Instance);
        var wsDiscoveryProbe = new WsDiscoveryProbe(NullLogger<WsDiscoveryProbe>.Instance);
        DiscoveryService = new PrinterDiscoveryService(orchestrator, mdnsProbe, wsDiscoveryProbe, NullLogger<PrinterDiscoveryService>.Instance);

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

    /// <summary>
    /// Fase 6: the encrypted store (DPAPI, see SnmpV3CredentialFileStore) is
    /// authoritative once it exists — LoadOrMigrate transparently copies
    /// appsettings.json's plaintext "SnmpV3" section into it (and scrubs the
    /// passwords out of the plaintext file) the first time this runs after
    /// upgrading. Also fixes a real bug: this used to read appsettings.json
    /// from the AGENTFOLDER root, which stopped being where the Service's
    /// appsettings.json actually lives once Service files moved into their
    /// own "Service" subfolder (see WindowsServiceInstaller.ServiceInstallPath)
    /// — SNMPv3 local fallback silently never worked from the ConfigTool
    /// since that change, on top of the plaintext-storage issue this fixes.
    /// </summary>
    private static SnmpV3Credentials? TryCreateV3Credentials()
    {
        try
        {
            var configPath = Path.Combine(WindowsServiceInstaller.ServiceInstallPath, "appsettings.json");
            var plaintextFallback = ReadPlaintextV3Fallback(configPath);

            var fileStore = new SnmpV3CredentialFileStore(NullLogger<SnmpV3CredentialFileStore>.Instance);
            var stored = fileStore.LoadOrMigrate(plaintextFallback, configPath);
            if (string.IsNullOrWhiteSpace(stored?.UserName))
            {
                return null;
            }

            return new SnmpV3Credentials(new SnmpV3Options
            {
                UserName = stored.UserName,
                SecurityLevel = stored.SecurityLevel,
                AuthenticationProtocol = stored.AuthenticationProtocol,
                AuthenticationPassword = stored.AuthenticationPassword,
                PrivacyProtocol = stored.PrivacyProtocol,
                PrivacyPassword = stored.PrivacyPassword,
                ContextName = stored.ContextName,
            });
        }
        catch
        {
            // If configuration is invalid, just fall back to v1/v2c
            return null;
        }
    }

    private static SnmpV3Options? ReadPlaintextV3Fallback(string configPath)
    {
        if (!File.Exists(configPath))
        {
            return null;
        }

        var configJson = File.ReadAllText(configPath);
        using var doc = System.Text.Json.JsonDocument.Parse(configJson);
        if (!doc.RootElement.TryGetProperty("Agent", out var agentSection) ||
            !agentSection.TryGetProperty("SnmpV3", out var v3Section))
        {
            return null;
        }

        return new SnmpV3Options
        {
            UserName = v3Section.TryGetProperty("UserName", out var userName) ? userName.GetString() : null,
            SecurityLevel = v3Section.TryGetProperty("SecurityLevel", out var secLevel) ? secLevel.GetString() ?? "authPriv" : "authPriv",
            AuthenticationProtocol = v3Section.TryGetProperty("AuthenticationProtocol", out var authProto) ? authProto.GetString() : null,
            AuthenticationPassword = v3Section.TryGetProperty("AuthenticationPassword", out var authPass) ? authPass.GetString() : null,
            PrivacyProtocol = v3Section.TryGetProperty("PrivacyProtocol", out var privProto) ? privProto.GetString() : null,
            PrivacyPassword = v3Section.TryGetProperty("PrivacyPassword", out var privPass) ? privPass.GetString() : null,
            ContextName = v3Section.TryGetProperty("ContextName", out var ctxName) ? ctxName.GetString() : null,
        };
    }
}
