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

    // Printer-MIB general table (walked, not GET'd at a fixed ".1" — a
    // multi-engine/multi-function device may index its printer sub-unit at
    // something other than 1, and a fixed GET would just miss it there).
    public const string PrtGeneralSerialNumberTable = "1.3.6.1.2.1.43.5.1.1.17";
    // Human-readable product name (e.g. "HP LaserJet P1102w") — a much more
    // reliable source for "model" than parsing sysDescr's free-text dump,
    // when the device implements it.
    public const string PrtGeneralPrinterNameTable = "1.3.6.1.2.1.43.5.1.1.16";
    public const string PrtMarkerLifeCountTotal = "1.3.6.1.2.1.43.10.2.1.4.1.1";

    // IF-MIB (network interface table, walked) — ifPhysAddress gives the
    // MAC address of each interface. Printer-MIB has no MAC OID of its own;
    // this is the standard, vendor-agnostic place to find it.
    public const string IfPhysAddressTable = "1.3.6.1.2.1.2.2.1.6";

    // Printer-MIB input tray table (walked — one row per paper tray/input
    // sub-unit). Used only to detect whether ANY tray is physically large
    // enough for A3 media (RFC 3805 §prtInputEntry; column numbers verified
    // against the published MIB text, not guessed): prtInputDimUnit (3)
    // says whether the two declared-dimension columns (4, 5) are in
    // micrometers or ten-thousandths of an inch. -1 ("no restriction") and
    // -2 ("unknown") are sentinels, never real dimensions (spec §67).
    public const string PrtInputDimUnitTable = "1.3.6.1.2.1.43.8.2.1.3";
    public const string PrtInputMediaDimFeedDirTable = "1.3.6.1.2.1.43.8.2.1.4";
    public const string PrtInputMediaDimXFeedDirTable = "1.3.6.1.2.1.43.8.2.1.5";
    public const int MediaUnitMicrometers = 4;
    public const int MediaUnitTenThousandthsOfInch = 3;

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
