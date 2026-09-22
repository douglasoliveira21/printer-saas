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
}
