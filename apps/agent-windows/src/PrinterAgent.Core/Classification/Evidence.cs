namespace PrinterAgent.Core.Classification;

/// <summary>One fact that pushed the classifier toward (or away from) "this is a printer".</summary>
public record Evidence(string Source, string Description, double Weight, bool IsNegative)
{
    public override string ToString() => $"{Source}:{Description}";
}

public record ClassificationResult(DeviceType Type, double Confidence, List<Evidence> Evidence);

/// <summary>Everything every probe (SNMP, IPP, TCP ports, mDNS, OUI, HTTP) collected for one host, before classification.</summary>
public class DeviceSignals
{
    public string? SysDescr { get; set; }
    public bool PrinterMibGeneralFound { get; set; }
    public bool PrinterMibCountersFound { get; set; }
    public bool PrinterMibSuppliesFound { get; set; }
    public IppProbeResult? Ipp { get; set; }
    public HashSet<int> OpenTcpPorts { get; set; } = [];
    public List<string> MdnsServices { get; set; } = [];
    public List<string> WsDiscoveryTypes { get; set; } = [];
    public string? HttpServerHeader { get; set; }
    public string? HttpBodySnippet { get; set; }
    public string? OuiVendor { get; set; }
    public bool OuiIsKnownPrinterVendor { get; set; }
    public bool OuiIsKnownInfraVendor { get; set; }
}

public class IppProbeResult
{
    public bool Responded { get; set; }
    public string? MakeAndModel { get; set; }
    public bool? ColorSupported { get; set; }
    public bool? DuplexSupported { get; set; }
    public bool? A3Supported { get; set; }
    public string? PrinterUuid { get; set; }

    /// <summary>Fase 13 (IPP avançado) — "idle"/"processing"/"stopped" (RFC 8011 §5.4.11, printer-state type1 enum: 3/4/5), or null when the device didn't report it. Never inferred from anything else.</summary>
    public string? PrinterState { get; set; }

    /// <summary>Fase 13 — raw printer-state-reasons keywords exactly as reported (RFC 8011 §5.4.12), e.g. "media-jam-error", "toner-low-warning". Never includes the literal "none" (that means "nothing to report", not a reason).</summary>
    public List<string>? PrinterStateReasons { get; set; }

    /// <summary>Fase 13 — printer-supply/printer-supply-description (PWG5100.13 §5.6.39), used only to fill in consumables SNMP's Printer-MIB supplies table didn't find at all — never overrides a real SNMP reading.</summary>
    public List<IppSupply>? Supplies { get; set; }

    /// <summary>Fase 13 — media-ready (RFC 8011 §5.4.16): media currently loaded in the device's trays, exactly as reported (e.g. "na_letter_8.5x11in"). Raw/informational only — never interpreted into a capability.</summary>
    public List<string>? MediaReady { get; set; }
}

/// <summary>
/// One decoded printer-supply octetString value (PWG5100.13 §5.6.39) — an
/// unordered ASCII "key=value;" text payload inside the octetString, per
/// the PWG's own IPP mailing-list clarification of that section (not a
/// fixed binary struct). Only the keys this client actually uses are
/// pulled out; anything else in the payload is ignored.
/// </summary>
public class IppSupply
{
    public string? Type { get; set; }
    public int? Level { get; set; }
    public int? MaxCapacity { get; set; }
    public string? ColorantName { get; set; }
    public string? Description { get; set; }
}
