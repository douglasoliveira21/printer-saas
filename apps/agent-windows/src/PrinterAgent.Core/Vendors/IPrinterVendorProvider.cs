namespace PrinterAgent.Core.Vendors;

/// <summary>
/// Extension point for manufacturer-specific data collection beyond
/// standard Printer-MIB/IPP (private enterprise OIDs, vendor HTTP APIs,
/// etc). Every concrete provider currently just inherits the generic
/// behavior — no private OID is hardcoded here unless it's been verified
/// against a real vendor document, never guessed (spec §67). This exists so
/// a verified vendor OID has an obvious, isolated place to live later
/// without touching the vendor-agnostic SNMP/IPP/classification pipeline.
/// </summary>
public interface IPrinterVendorProvider
{
    /// <summary>Manufacturer name(s) this provider claims, matched the same way <c>PrinterMibOids.KnownManufacturers</c> already is.</summary>
    IReadOnlyList<string> ManufacturerAliases { get; }
}
