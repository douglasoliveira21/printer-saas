namespace PrinterAgent.Core.Snmp;

/// <summary>
/// Standard MIB-II / Printer-MIB (RFC 3805) OIDs, vendor-agnostic on
/// purpose (spec §17-18). Manufacturer-specific OIDs would live in their
/// own file per vendor when that becomes necessary — this file must never
/// grow vendor branches itself.
/// </summary>
public static class PrinterMibOids
{
    // MIB-II (system)
    public const string SysDescr = "1.3.6.1.2.1.1.1.0";
    public const string SysName = "1.3.6.1.2.1.1.5.0";

    // Printer-MIB
    public const string PrtGeneralSerialNumber = "1.3.6.1.2.1.43.5.1.1.17.1";
    public const string PrtMarkerLifeCountTotal = "1.3.6.1.2.1.43.10.2.1.4.1.1";

    // Printer-MIB marker table (walked — one row per marking engine). Most
    // devices expose a single marker (index 1, same value as
    // PrtMarkerLifeCountTotal above), but devices with separate mono/color
    // engines expose one row per engine here. prtMarkerProcessColorants
    // lists the colorants a marker uses (e.g. "black" vs
    // "cyan-magenta-yellow-black"), which is the standard, vendor-agnostic
    // way to tell a mono marker's life count from a color marker's.
    public const string PrtMarkerLifeCountTable = "1.3.6.1.2.1.43.10.2.1.4.1";
    public const string PrtMarkerProcessColorantsTable = "1.3.6.1.2.1.43.10.2.1.6.1";

    // Printer-MIB supplies table (walked — one row per consumable)
    public const string PrtMarkerSuppliesDescriptionTable = "1.3.6.1.2.1.43.11.1.1.6.1";
    public const string PrtMarkerSuppliesLevelTable = "1.3.6.1.2.1.43.11.1.1.9.1";
    public const string PrtMarkerSuppliesMaxCapacityTable = "1.3.6.1.2.1.43.11.1.1.8.1";

    public static readonly (string Keyword, string Color)[] SupplyColorKeywords =
    [
        ("black", "black"),
        ("cyan", "cyan"),
        ("magenta", "magenta"),
        ("yellow", "yellow"),
    ];

    public static readonly string[] KnownManufacturers =
    [
        "HP", "Hewlett-Packard", "Brother", "Epson", "Canon", "Ricoh", "Kyocera",
        "Xerox", "Lexmark", "Samsung", "Konica Minolta", "OKI", "Sharp", "Toshiba", "Panasonic",
    ];
}
