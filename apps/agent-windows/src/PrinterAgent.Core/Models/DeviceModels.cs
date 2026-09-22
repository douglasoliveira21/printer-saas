using System.Text.Json.Serialization;

namespace PrinterAgent.Core.Models;

/// <summary>
/// Mirrors apps/api/src/agents/dto/agent-payloads.dto.ts exactly — the
/// Agent normalizes what it finds into this shape and nothing more (spec
/// §65-66). Absent/unknown fields are simply omitted (null), never guessed.
/// </summary>
public class DiscoveredDevice
{
    public string? Ip { get; set; }
    public string? Mac { get; set; }
    public string? Hostname { get; set; }
    public string? Serial { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? Firmware { get; set; }
    public string? SysDescr { get; set; }
    public DeviceCounters? Counters { get; set; }
    public List<DeviceConsumable>? Consumables { get; set; }

    /// <summary>"SNMP" (default, network discovery) or "MANUAL" (added by IP or found via USB, without a network probe).</summary>
    public string? CollectionMethod { get; set; }

    /// <summary>
    /// Null = couldn't determine (device doesn't expose the input tray
    /// table at all). True/false = at least one input tray's declared
    /// media dimensions were read and classified — never guessed from the
    /// model name (spec §67). Drives whether the UI shows A3-specific
    /// fields at all, instead of showing "não disponível" for every
    /// printer regardless of whether it can even take A3 paper.
    /// </summary>
    public bool? SupportsA3 { get; set; }
}

public class DeviceCounters
{
    public int? Total { get; set; }
    public int? BlackWhite { get; set; }
    public int? Color { get; set; }
    public int? Copies { get; set; }
    public Dictionary<string, object?>? Raw { get; set; }
}

public class DeviceConsumable
{
    public required string Type { get; set; }
    public string? Color { get; set; }
    public double? LevelPercent { get; set; }
    public string? Capacity { get; set; }
    public string? Name { get; set; }
    public string? Serial { get; set; }
}

public class SubmitDevicesRequest
{
    public required List<DiscoveredDevice> Devices { get; set; }
}

public class EnrollRequest
{
    public required string EnrollmentToken { get; set; }
    public string? Hostname { get; set; }
    public string? AgentVersion { get; set; }
}

public class EnrollResponse
{
    [JsonPropertyName("agentId")]
    public required string AgentId { get; set; }

    [JsonPropertyName("apiKey")]
    public required string ApiKey { get; set; }
}

public class HeartbeatRequest
{
    public string? Hostname { get; set; }
    public string? OsVersion { get; set; }
    public string? LocalIp { get; set; }
    public string? AgentVersion { get; set; }
}

public class AgentConfigResponse
{
    public AgentDiscoveryConfig? DiscoveryConfig { get; set; }
}

public class AgentDiscoveryConfig
{
    public List<string>? Networks { get; set; }
    public string? SnmpCommunity { get; set; }
}

/// <summary>Mirrors the Printer row shape returned by GET /agent-api/v1/printers — only the fields the ConfigTool's Impressoras tab needs.</summary>
public class AgentPrinterSummary
{
    public required string Id { get; set; }
    public string? Status { get; set; }
    public string? OnlineStatus { get; set; }
    public string? CollectionMethod { get; set; }
    public string? Ip { get; set; }
    public string? Mac { get; set; }
    public string? Hostname { get; set; }
    public string? Serial { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime? MonitoredAt { get; set; }
}

/// <summary>GET /agent-api/v1/printers/:id — summary fields plus every counter/consumable reading the SaaS actually has (never invented — spec §67).</summary>
public class AgentPrinterDetail : AgentPrinterSummary
{
    public string? Firmware { get; set; }
    public string? SysDescr { get; set; }
    public List<AgentCounterReading>? Counters { get; set; }
    public List<AgentConsumableReading>? Consumables { get; set; }
}

public class AgentCounterReading
{
    public int? Total { get; set; }
    public int? BlackWhite { get; set; }
    public int? Color { get; set; }
    public int? Copies { get; set; }
    public DateTime CollectedAt { get; set; }
}

public class AgentConsumableReading
{
    public required string Type { get; set; }
    public string? Color { get; set; }
    public double? LevelPercent { get; set; }
    public string? Name { get; set; }
    public DateTime CollectedAt { get; set; }
}

public class AgentPrinterIdsRequest
{
    public required List<string> Ids { get; set; }
}
