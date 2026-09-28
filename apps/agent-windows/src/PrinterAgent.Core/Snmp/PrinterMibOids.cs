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

    // Printer-MIB media path table (walked — one row per paper path the
    // device has). prtMediaPathDescription (RFC 3805 column 10) is free text
    // but devices consistently label 2-sided paths as such (e.g. "2-sided,
    // long edge feed, paper path") — confirmed against a real Samsung
    // SL-M4070FR's SNMP dump, not guessed. A device whose only path is
    // "1-sided" doesn't support duplex; one with no media path table at all
    // is unknown (null), same as today.
    public const string PrtMediaPathDescriptionTable = "1.3.6.1.2.1.43.13.4.1.10";

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
    // prtMarkerSuppliesColorantIndex (column 3) — links a supply row to its
    // colorant row in prtMarkerColorantTable below; 0 = no such association
    // (RFC 3805, column numbers verified against the published MIB text,
    // source: https://raw.githubusercontent.com/richb-intermapper/CreatingInterMapperProbes/master/MIB%20Files/RFC3805-Printer-MIB.txt).
    public const string PrtMarkerSuppliesColorantIndexTable = "1.3.6.1.2.1.43.11.1.1.3.1";
    // prtMarkerSuppliesType (column 5), SYNTAX PrtMarkerSuppliesTypeTC — this
    // textual convention is NOT defined in RFC 3805 itself, it's imported
    // from the separately IANA-maintained IANA-PRINTER-MIB module (extended
    // over time via PWG/IANA expert review, per RFC 8126). Enum values below
    // verified against the authoritative IANA registry text, NOT assumed
    // from memory: https://www.iana.org/assignments/ianaprinter-mib/ianaprinter-mib.txt
    // (mirrored at https://raw.githubusercontent.com/librenms/librenms-mibs/master/IANA-PRINTER-MIB).
    public const string PrtMarkerSuppliesTypeTable = "1.3.6.1.2.1.43.11.1.1.5.1";

    // Printer-MIB colorant table (walked — one row per colorant a marker
    // uses). prtMarkerColorantValue (column 4) is free text but RFC 3805
    // requires it to use standardized ISO 10175/10180 color names ("black",
    // "cyan", "magenta", "yellow", "red", "green", "blue", "white", "other",
    // "unknown") — reading it directly is more reliable than the keyword
    // match this codebase already does against prtMarkerSuppliesDescription.
    public const string PrtMarkerColorantValueTable = "1.3.6.1.2.1.43.12.1.1.4.1";

    // Printer-MIB cover table (walked — one row per cover/access panel,
    // e.g. front door, duplexer cover). prtCoverStatus (column 3), SYNTAX
    // PrtCoverStatusTC — imported from IANA-PRINTER-MIB same as the supplies
    // type above; enum values sourced from the same IANA registry text.
    public const string PrtCoverDescriptionTable = "1.3.6.1.2.1.43.6.1.1.2.1";
    public const string PrtCoverStatusTable = "1.3.6.1.2.1.43.6.1.1.3.1";

    /// <summary>
    /// PrtMarkerSuppliesTypeTC (IANA-PRINTER-MIB). Only the values a real
    /// printer/MFP realistically reports are mapped to a name; finishing
    /// -equipment-only values (staples, inserts, covers, binding/banding
    /// supply, stitching wire, shrink/paper wrap — RFC 3806 Finisher-MIB
    /// territory) are included too since they're part of the same TC and
    /// cost nothing to map correctly. other(1) maps to "other", not to a
    /// specific consumable kind — that's what the device itself reported.
    /// </summary>
    public static readonly Dictionary<int, string> MarkerSuppliesTypeNames = new()
    {
        [1] = "other",
        [2] = "unknown",
        [3] = "toner",
        [4] = "wasteToner",
        [5] = "ink",
        [6] = "inkCartridge",
        [7] = "inkRibbon",
        [8] = "wasteInk",
        [9] = "opc",
        [10] = "developer",
        [11] = "fuserOil",
        [12] = "solidWax",
        [13] = "ribbonWax",
        [14] = "wasteWax",
        [15] = "fuser",
        [16] = "coronaWire",
        [17] = "fuserOilWick",
        [18] = "cleanerUnit",
        [19] = "fuserCleaningPad",
        [20] = "transferUnit",
        [21] = "tonerCartridge",
        [22] = "fuserOiler",
        [23] = "water",
        [24] = "wasteWater",
        [25] = "glueWaterAdditive",
        [26] = "wastePaper",
        [27] = "bindingSupply",
        [28] = "bandingSupply",
        [29] = "stitchingWire",
        [30] = "shrinkWrap",
        [31] = "paperWrap",
        [32] = "staples",
        [33] = "inserts",
        [34] = "covers",
    };

    /// <summary>
    /// PrtCoverStatusTC (IANA-PRINTER-MIB) — note value 2 is deliberately
    /// absent from the registry (not a gap in this mapping).
    /// </summary>
    public static readonly Dictionary<int, string> CoverStatusNames = new()
    {
        [1] = "other",
        [3] = "open",
        [4] = "closed",
        [5] = "interlockOpen",
        [6] = "interlockClosed",
    };

    // Printer-MIB alert table (walked — one row per active alert/error
    // condition). Vendor-agnostic standard OIDs (RFC 3805 prtAlertEntry,
    // column numbers verified against the published MIB text, not guessed):
    // prtAlertSeverityLevel (2), prtAlertCode (7), prtAlertDescription (8).
    public const string PrtAlertSeverityLevelTable = "1.3.6.1.2.1.43.18.1.1.2.1";
    public const string PrtAlertCodeTable = "1.3.6.1.2.1.43.18.1.1.7.1";
    public const string PrtAlertDescriptionTable = "1.3.6.1.2.1.43.18.1.1.8.1";

    // prtAlertSeverityLevel enum values (RFC 3805) — other(1) is never
    // reported as a severity string, only critical/warning are meaningful.
    public const int AlertSeverityCritical = 3;
    public const int AlertSeverityWarning = 4;

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
