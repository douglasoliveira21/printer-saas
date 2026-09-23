namespace PrinterAgent.Core.Configuration;

/// <summary>
/// Bound from appsettings.json ("Agent" section). The one-time enrollment
/// token lives only here (operator-provided at install time); the
/// permanent AgentId/ApiKey issued by the backend are persisted separately
/// via <see cref="AgentCredentialStore"/>, never written back to this file.
/// </summary>
public class AgentOptions
{
    public const string SectionName = "Agent";

    /// <summary>Base URL of the Printer SaaS API, e.g. https://api.seudominio.com.br</summary>
    public string ApiUrl { get; set; } = "http://localhost:3001";

    /// <summary>One-time installation token (spec §12) — only used once, on first run.</summary>
    public string? EnrollmentToken { get; set; }

    public int HeartbeatIntervalSeconds { get; set; } = 30;

    public int DiscoveryIntervalSeconds { get; set; } = 3600;

    /// <summary>When false, the scheduled discovery sweep never runs — manual "Buscar agora" from the ConfigTool's Ferramentas tab still does, since that's an explicit user action.</summary>
    public bool DiscoveryEnabled { get; set; } = true;

    public int CollectionIntervalSeconds { get; set; } = 900;

    /// <summary>CIDR ranges to scan, e.g. "192.168.1.0/24". Empty = discovery disabled until configured via GET /config.</summary>
    public List<string> Networks { get; set; } = [];

    public string SnmpCommunity { get; set; } = "public";

    public int SnmpTimeoutMs { get; set; } = 1500;

    public int SnmpRetries { get; set; } = 1;

    /// <summary>Max concurrent SNMP/ping probes during a discovery sweep — never scan a /24 all at once.</summary>
    public int DiscoveryConcurrency { get; set; } = 16;

    /// <summary>Max number of pending submissions kept in the offline queue (spec §39) before oldest entries are dropped.</summary>
    public int OfflineQueueMaxEntries { get; set; } = 200;

    /// <summary>SNMP v3 configuration - when enabled, v3 is tried before v2c/v1 fallback.</summary>
    public SnmpV3Options? SnmpV3 { get; set; }

    /// <summary>How often to poll GET /agent-api/v1/latest-release. Set to 0 to disable auto-update entirely.</summary>
    public int UpdateCheckIntervalHours { get; set; } = 24;
}

/// <summary>
/// SNMP v3 security configuration (spec §16). All fields are optional to support
/// different security levels (noAuthNoPriv, authNoPriv, authPriv).
/// </summary>
public class SnmpV3Options
{
    /// <summary>Security name (username) for SNMP v3 authentication.</summary>
    public string? UserName { get; set; }

    /// <summary>Security level: noAuthNoPriv, authNoPriv, or authPriv.</summary>
    public string SecurityLevel { get; set; } = "authPriv";

    /// <summary>Authentication protocol: MD5, SHA1, SHA256, SHA384, or SHA512. Required for authNoPriv and authPriv.</summary>
    public string? AuthenticationProtocol { get; set; }

    /// <summary>Authentication passphrase. Required for authNoPriv and authPriv.</summary>
    public string? AuthenticationPassword { get; set; }

    /// <summary>Privacy protocol: DES, AES128, AES192, or AES256. Required for authPriv.</summary>
    public string? PrivacyProtocol { get; set; }

    /// <summary>Privacy passphrase. Required for authPriv.</summary>
    public string? PrivacyPassword { get; set; }

    /// <summary>Context name (optional, most devices use empty context).</summary>
    public string? ContextName { get; set; }
}
