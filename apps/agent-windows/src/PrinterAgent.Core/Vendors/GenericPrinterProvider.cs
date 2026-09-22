namespace PrinterAgent.Core.Vendors;

/// <summary>Fallback for any manufacturer without a dedicated provider — standard Printer-MIB/IPP only, exactly today's behavior.</summary>
public class GenericPrinterProvider : IPrinterVendorProvider
{
    public IReadOnlyList<string> ManufacturerAliases => [];
}
