using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Models;

namespace PrinterAgent.Core.Snmp;

/// <summary>
/// Thread-safe, live-updatable holder for the SNMP v3 credentials resolved
/// server-side (<c>AgentsService.getConfig</c> → <see cref="AgentSnmpV3Config"/>)
/// — refreshed on every <c>AgentWorker.RefreshRemoteConfigAsync</c> poll, so a
/// credential created/changed/removed in the web app reaches the Agent
/// without a service restart.
///
/// <see cref="SnmpDeviceReader"/> asks this store for a credential by IP at
/// probe time instead of being constructed with a single fixed credential —
/// that's what makes per-printer (really per-IP, see the doc comment on
/// <see cref="AgentSnmpV3Config"/> for why) SNMP v3 possible without
/// threading a credential parameter through every orchestration layer above
/// it.
/// </summary>
public class SnmpV3CredentialStore
{
    private readonly object _lock = new();
    private SnmpV3Credentials? _default;
    private Dictionary<string, SnmpV3Credentials> _perIp = new();

    /// <param name="localFallback">
    /// The single agent-wide credential from appsettings.json's "SnmpV3"
    /// section, if any — kept as the ultimate fallback so a standalone/
    /// offline Agent (or one that just hasn't polled remote config yet)
    /// still authenticates the way it did before per-printer overrides
    /// existed. Overwritten by the server's "default" the first time remote
    /// config is fetched and the server actually has one configured.
    /// </param>
    public SnmpV3CredentialStore(SnmpV3Credentials? localFallback)
    {
        _default = localFallback;
    }

    public void UpdateFromRemote(AgentSnmpV3Config? remote)
    {
        if (remote is null)
        {
            return;
        }

        var perIp = new Dictionary<string, SnmpV3Credentials>();
        foreach (var (ip, credential) in remote.PerIp ?? new Dictionary<string, AgentSnmpV3Credential>())
        {
            var converted = ToCredentials(credential);
            if (converted is not null)
            {
                perIp[ip] = converted;
            }
        }

        lock (_lock)
        {
            // Only overwrite the default if the server actually sent one —
            // an Agent with no Agent.defaultSnmpV3CredentialId configured
            // yet shouldn't lose its local appsettings.json fallback just
            // because it successfully polled config.
            if (remote.Default is not null)
            {
                _default = ToCredentials(remote.Default);
            }
            _perIp = perIp;
        }
    }

    /// <summary>Per-IP override wins, then the default (server or local), then null (caller falls back to v1/v2c).</summary>
    public SnmpV3Credentials? Resolve(string ip)
    {
        lock (_lock)
        {
            return _perIp.TryGetValue(ip, out var overrideCredential) ? overrideCredential : _default;
        }
    }

    /// <summary>Invalid credentials from the server (shouldn't happen — the API validates on write) are dropped with a null return rather than throwing and aborting the whole config refresh over one bad entry.</summary>
    private static SnmpV3Credentials? ToCredentials(AgentSnmpV3Credential? c)
    {
        if (c is null)
        {
            return null;
        }
        try
        {
            return new SnmpV3Credentials(new SnmpV3Options
            {
                UserName = c.UserName,
                SecurityLevel = c.SecurityLevel,
                AuthenticationProtocol = c.AuthenticationProtocol,
                AuthenticationPassword = c.AuthenticationPassword,
                PrivacyProtocol = c.PrivacyProtocol,
                PrivacyPassword = c.PrivacyPassword,
                ContextName = c.ContextName,
            });
        }
        catch (ArgumentException)
        {
            return null;
        }
    }
}
