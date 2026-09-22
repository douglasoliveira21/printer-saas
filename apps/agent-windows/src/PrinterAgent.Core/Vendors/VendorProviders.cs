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

    // hpHttpMgSerialNumber, from HP's own HP-httpManageable-MIB —
    // "Serial number of entity." Confirmed against HP's published MIB
    // (not guessed), used only as a fallback when the standard Printer-MIB
    // prtGeneralSerialNumber (RFC 3805) comes back empty, which happens on
    // several entry-level HP models (e.g. the LaserJet P1102w) that don't
    // fully implement Printer-MIB but do answer this one.
    public string? SerialNumberOid => "1.3.6.1.4.1.11.2.36.1.1.2.9";
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
