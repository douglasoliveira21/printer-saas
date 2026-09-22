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
