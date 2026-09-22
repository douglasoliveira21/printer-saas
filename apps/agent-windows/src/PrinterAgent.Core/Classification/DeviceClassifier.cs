using PrinterAgent.Core.Snmp;

namespace PrinterAgent.Core.Classification;

/// <summary>
/// Decides what a host actually is from everything the probes collected —
/// never from a single signal alone. A negative keyword match (router,
/// firewall, switch, AP, camera, hypervisor...) in sysDescr/HTTP vetoes
/// classification as a printer outright, regardless of how much weak
/// circumstantial positive evidence (OUI, open port) also happened to match.
/// Only Printer/Mfp/Plotter with real, source-backed evidence ever reach the
/// caller with confidence high enough to become a managed Printer row — a
/// bare "responded to SNMP/ping" is never enough (spec §67: never invent).
/// </summary>
public static class DeviceClassifier
{
    private const double MinConfidenceToClassifyAsPrinter = 0.4;

    private static readonly (string Keyword, DeviceType Type)[] InfraTypeHints =
    [
        ("firewall", DeviceType.Firewall), ("pfsense", DeviceType.Firewall), ("opnsense", DeviceType.Firewall),
        ("fortinet", DeviceType.Firewall), ("sonicwall", DeviceType.Firewall), ("watchguard", DeviceType.Firewall),
        ("router", DeviceType.Router), ("roteador", DeviceType.Router), ("mikrotik", DeviceType.Router),
        ("routeros", DeviceType.Router), ("gateway", DeviceType.Router), ("dd-wrt", DeviceType.Router),
        ("openwrt", DeviceType.Router),
        ("switch", DeviceType.Switch), ("catalyst", DeviceType.Switch),
        ("access point", DeviceType.AccessPoint), ("unifi", DeviceType.AccessPoint), ("ubiquiti", DeviceType.AccessPoint),
        ("aruba", DeviceType.AccessPoint),
        ("camera", DeviceType.Camera), ("câmera", DeviceType.Camera), ("nvr", DeviceType.Camera), ("dvr", DeviceType.Camera),
        ("esxi", DeviceType.Server), ("vmware", DeviceType.Server), ("hypervisor", DeviceType.Server),
        ("windows server", DeviceType.Server),
    ];

    public static ClassificationResult Classify(DeviceSignals s)
    {
        var evidence = new List<Evidence>();

        var combinedText = string.Join(" ", new[] { s.SysDescr, s.HttpServerHeader, s.HttpBodySnippet }
            .Where(t => !string.IsNullOrWhiteSpace(t)));

        foreach (var (keyword, type) in InfraTypeHints)
        {
            if (combinedText.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            {
                evidence.Add(new Evidence("keyword", $"\"{keyword}\" em sysDescr/HTTP", 1.0, IsNegative: true));
                return new ClassificationResult(type, 0.9, evidence);
            }
        }

        double score = 0;
        var hasStrongPositive = false;

        if (s.PrinterMibGeneralFound)
        {
            score += 0.5;
            hasStrongPositive = true;
            evidence.Add(new Evidence("printer_mib", "Nome/série via Printer-MIB", 0.5, false));
        }
        if (s.PrinterMibCountersFound)
        {
            score += 0.3;
            hasStrongPositive = true;
            evidence.Add(new Evidence("printer_mib", "Contadores Printer-MIB", 0.3, false));
        }
        if (s.PrinterMibSuppliesFound)
        {
            score += 0.2;
            evidence.Add(new Evidence("printer_mib", "Suprimentos Printer-MIB", 0.2, false));
        }
        if (s.Ipp?.Responded == true)
        {
            score += 0.5;
            hasStrongPositive = true;
            evidence.Add(new Evidence("ipp", "IPP respondeu com atributos de impressora", 0.5, false));
        }
        if (s.OpenTcpPorts.Contains(9100))
        {
            score += 0.25;
            hasStrongPositive = true;
            evidence.Add(new Evidence("tcp_port", "Porta 9100 (JetDirect/raw print) aberta", 0.25, false));
        }
        if (s.MdnsServices.Any(m => m.Contains("_ipp._tcp", StringComparison.OrdinalIgnoreCase) || m.Contains("_printer._tcp", StringComparison.OrdinalIgnoreCase)))
        {
            score += 0.3;
            hasStrongPositive = true;
            evidence.Add(new Evidence("mdns", "mDNS anuncia serviço de impressão", 0.3, false));
        }
        if (s.OuiIsKnownPrinterVendor)
        {
            score += 0.15;
            evidence.Add(new Evidence("oui", $"OUI de fabricante de impressora ({s.OuiVendor})", 0.15, false));
        }
        if (!string.IsNullOrWhiteSpace(s.SysDescr) && PrinterMibOids.KnownManufacturers.Any(m => s.SysDescr.Contains(m, StringComparison.OrdinalIgnoreCase)))
        {
            score += 0.15;
            evidence.Add(new Evidence("sysdescr", "Fabricante de impressora conhecido no sysDescr", 0.15, false));
        }
        if (s.OuiIsKnownInfraVendor)
        {
            score -= 0.3;
            evidence.Add(new Evidence("oui", $"OUI de fabricante de rede ({s.OuiVendor})", 0.3, true));
        }

        score = Math.Clamp(score, 0, 1.0);

        if (!hasStrongPositive || score < MinConfidenceToClassifyAsPrinter)
        {
            return new ClassificationResult(DeviceType.Unknown, score, evidence);
        }

        // Mfp vs plain Printer is refined later by the caller once
        // manufacturer/model are known (ModelDatabase hint / IPP
        // make-and-model text) — the classifier itself only knows
        // "this smells like a print-capable device", not which kind.
        return new ClassificationResult(DeviceType.Printer, score, evidence);
    }
}
