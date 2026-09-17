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
}
