namespace PrinterAgent.Core.Vendors;

// Scaffold only — every provider below currently behaves exactly like
// GenericPrinterProvider (standard Printer-MIB/IPP, no private OIDs). Each
// is a documented, isolated place to add that vendor's VERIFIED private
// enterprise OIDs later (e.g. for copies/duplex counters, which have no
// RFC 3805 equivalent — see docs/agent.md). Never add an OID here without
// confirming it against a real vendor MIB/document first.

public class HpPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["HP", "Hewlett-Packard"];

    // Tried in order, only as a fallback when the standard Printer-MIB
    // prtGeneralSerialNumber (RFC 3805) comes back empty:
    //   1. hpHttpMgSerialNumber, from HP's own HP-httpManageable-MIB —
    //      "Serial number of entity." Some entry-level HP models implement
    //      Printer-MIB partially but do answer this one.
    //   2. The older hpicMgmt/LaserJet-common private table's serial field
    //      (part of the same table exposing product/model/firmware date —
    //      see the sibling OIDs .3.1 product number, .3.2 model name).
    //      Confirmed working against a real HP LaserJet Pro P1102w via the
    //      ConfigTool's SNMP diagnostic tool — that unit answers NEITHER
    //      Printer-MIB's serial OID NOR hpHttpMgSerialNumber, only this one.
    public IReadOnlyList<string> SerialNumberOids =>
    [
        "1.3.6.1.4.1.11.2.36.1.1.2.9",
        "1.3.6.1.4.1.11.2.3.9.4.2.1.1.3.3.0",
    ];
}

public class CanonPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Canon"];
}

public class BrotherPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Brother"];
}

public class EpsonPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Epson"];
}

public class KyoceraPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Kyocera"];
}

public class RicohPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Ricoh"];
}

public class XeroxPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Xerox"];
}

public class LexmarkPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Lexmark"];
}

public class KonicaMinoltaPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Konica Minolta"];
}

public class SharpPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Sharp"];
}

public class ToshibaPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Toshiba"];
}

public class SamsungPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => ["Samsung"];
}
