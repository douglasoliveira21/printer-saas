namespace PrinterAgent.Core.Classification;

/// <summary>
/// What a discovered host actually is. Only Printer/Mfp/Plotter ever become a
/// managed Printer row — everything else exists purely so the classifier can
/// explain *why* a host was rejected (spec: never silently guess).
/// </summary>
public enum DeviceType
{
    Unknown,
    Printer,
    Mfp,
    Plotter,
    Router,
    Firewall,
    Switch,
    AccessPoint,
    Server,
    Computer,
    Camera,
}
