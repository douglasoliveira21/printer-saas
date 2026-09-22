namespace PrinterAgent.Core.Discovery;

/// <summary>
/// MAC prefix (OUI, first 3 octets) → vendor, for classification evidence.
/// Intentionally a small, currently-verified seed list, not the full IEEE
/// OUI registry (30k+ entries) — an unmatched prefix contributes no OUI
/// evidence either way (never "unknown vendor = not a printer"). OUI is
/// always a *weak* signal in the classifier (never decides alone), so a
/// gap here just means one less corroborating fact, not a wrong verdict.
/// Add entries only once actually confirmed (e.g. cross-checked against
/// IEEE's public OUI assignment list at standards-oui.ieee.org) — the two
/// below were observed directly on real devices during this project
/// (see the pfSense/HP MACs seen in this session's own testing).
/// </summary>
public static class OuiVendorLookup
{
    private static readonly Dictionary<string, string> PrinterVendors = new(StringComparer.OrdinalIgnoreCase)
    {
        ["1C:C1:DE"] = "HP",
        ["30:CD:A7"] = "Samsung",
    };

    private static readonly Dictionary<string, string> InfraVendors = new(StringComparer.OrdinalIgnoreCase)
    {
        ["60:BE:B4"] = "Netgate/pfSense",
    };

    public static (string? Vendor, bool IsPrinterVendor, bool IsInfraVendor) Lookup(string? mac)
    {
        if (string.IsNullOrWhiteSpace(mac) || mac.Length < 8)
        {
            return (null, false, false);
        }
        var prefix = mac[..8];
        if (PrinterVendors.TryGetValue(prefix, out var printerVendor))
        {
            return (printerVendor, true, false);
        }
        if (InfraVendors.TryGetValue(prefix, out var infraVendor))
        {
            return (infraVendor, false, true);
        }
        return (null, false, false);
    }
}
