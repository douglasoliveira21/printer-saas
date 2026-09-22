namespace PrinterAgent.Core.Vendors;

/// <summary>Resolves the right provider for a manufacturer string, falling back to generic when there's no dedicated one (or none at all yet).</summary>
public class VendorProviderRegistry
{
    private static readonly IPrinterVendorProvider[] Providers =
    [
        new HpPrinterProvider(), new CanonPrinterProvider(), new BrotherPrinterProvider(),
        new EpsonPrinterProvider(), new KyoceraPrinterProvider(), new RicohPrinterProvider(),
        new XeroxPrinterProvider(), new LexmarkPrinterProvider(), new KonicaMinoltaPrinterProvider(),
        new SharpPrinterProvider(), new ToshibaPrinterProvider(), new SamsungPrinterProvider(),
    ];

    private static readonly GenericPrinterProvider Generic = new();

    public static IPrinterVendorProvider Resolve(string? manufacturer)
    {
        if (string.IsNullOrWhiteSpace(manufacturer))
        {
            return Generic;
        }
        foreach (var provider in Providers)
        {
            if (provider.ManufacturerAliases.Any(a => manufacturer.Contains(a, StringComparison.OrdinalIgnoreCase)))
            {
                return provider;
            }
        }
        return Generic;
    }
}
