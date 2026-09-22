using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using PrinterAgent.Core.Classification;

namespace PrinterAgent.Core.Discovery;

public class ModelDatabaseEntry
{
    [JsonPropertyName("manufacturerAliases")]
    public List<string> ManufacturerAliases { get; set; } = [];

    [JsonPropertyName("modelPattern")]
    public string ModelPattern { get; set; } = "";

    [JsonPropertyName("deviceTypeHint")]
    public string DeviceTypeHint { get; set; } = "";

    /// <summary>Exact (case-insensitive) match against the raw model string the device itself reported over SNMP/IPP — e.g. some firmwares report a compact internal code like "SAMSUNGM4070" instead of the name printed on the unit.</summary>
    [JsonPropertyName("rawModelAlias")]
    public string? RawModelAlias { get; set; }

    /// <summary>Friendlier name to show instead, ONLY used when rawModelAlias matches exactly — never a fuzzy/generic rewrite. Add an entry here only once a specific device's real model has actually been confirmed (e.g. from the unit's own label), never guessed.</summary>
    [JsonPropertyName("displayName")]
    public string? DisplayName { get; set; }

    /// <summary>Only applied together with an exact rawModelAlias match (never with the fuzzy modelPattern) — confirms a specific, identified unit is monochrome-only when SNMP/IPP didn't otherwise say so.</summary>
    [JsonPropertyName("colorHint")]
    public bool? ColorHint { get; set; }
}

/// <summary>
/// Small, extensible knowledge base (embedded JSON, not hardcoded logic) that
/// only ever gives a *family* hint (Printer vs Mfp vs Plotter) once a
/// manufacturer/model has already been identified by a real source (SNMP,
/// IPP) — it never invents a manufacturer/model/capability value itself,
/// and never runs before the classifier has already decided "this is
/// print-capable" from actual evidence. Extend by adding rows to
/// printer-model-database.json, no recompilation of matching logic needed.
/// </summary>
public class ModelDatabase
{
    private readonly List<ModelDatabaseEntry> _entries;
    private readonly ILogger<ModelDatabase> _logger;

    public ModelDatabase(ILogger<ModelDatabase> logger)
    {
        _logger = logger;
        _entries = Load();
    }

    public DeviceType? LookupDeviceTypeHint(string? manufacturer, string? model)
    {
        if (string.IsNullOrWhiteSpace(model))
        {
            return null;
        }
        foreach (var entry in _entries)
        {
            if (!model.Contains(entry.ModelPattern, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (entry.ManufacturerAliases.Count > 0 &&
                !string.IsNullOrWhiteSpace(manufacturer) &&
                !entry.ManufacturerAliases.Any(a => manufacturer.Contains(a, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }
            if (Enum.TryParse<DeviceType>(entry.DeviceTypeHint, ignoreCase: true, out var type))
            {
                return type;
            }
        }
        return null;
    }

    /// <summary>
    /// Some devices report a compact internal model code over SNMP/IPP
    /// instead of the name printed on the unit (e.g. Samsung's SL-M4070FR
    /// reports "SAMSUNGM4070"). Only rewrites on an EXACT match against a
    /// confirmed alias — anything not in the table is shown exactly as the
    /// device reported it, never reformatted/guessed (spec §67).
    /// </summary>
    public string? LookupDisplayName(string? manufacturer, string? rawModel)
    {
        if (string.IsNullOrWhiteSpace(rawModel))
        {
            return null;
        }
        foreach (var entry in _entries)
        {
            if (entry.RawModelAlias is null || entry.DisplayName is null)
            {
                continue;
            }
            if (!string.Equals(entry.RawModelAlias, rawModel, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (entry.ManufacturerAliases.Count > 0 &&
                !string.IsNullOrWhiteSpace(manufacturer) &&
                !entry.ManufacturerAliases.Any(a => manufacturer.Contains(a, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }
            return entry.DisplayName;
        }
        return null;
    }

    /// <summary>Same exact-match rule as LookupDisplayName — only fires for a specifically identified unit, never a fuzzy family match.</summary>
    public bool? LookupColorHint(string? manufacturer, string? rawModel)
    {
        if (string.IsNullOrWhiteSpace(rawModel))
        {
            return null;
        }
        foreach (var entry in _entries)
        {
            if (entry.RawModelAlias is null || entry.ColorHint is null)
            {
                continue;
            }
            if (!string.Equals(entry.RawModelAlias, rawModel, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (entry.ManufacturerAliases.Count > 0 &&
                !string.IsNullOrWhiteSpace(manufacturer) &&
                !entry.ManufacturerAliases.Any(a => manufacturer.Contains(a, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }
            return entry.ColorHint;
        }
        return null;
    }

    private List<ModelDatabaseEntry> Load()
    {
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            var resourceName = assembly.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("printer-model-database.json", StringComparison.OrdinalIgnoreCase));
            if (resourceName is null)
            {
                _logger.LogWarning("printer-model-database.json not embedded — model hints disabled");
                return [];
            }
            using var stream = assembly.GetManifestResourceStream(resourceName);
            using var reader = new StreamReader(stream!);
            var json = reader.ReadToEnd();
            return JsonSerializer.Deserialize<List<ModelDatabaseEntry>>(json) ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load printer-model-database.json — model hints disabled");
            return [];
        }
    }
}
