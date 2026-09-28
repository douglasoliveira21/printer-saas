using System.Collections.Concurrent;
using System.Net;
using Microsoft.Extensions.Logging;
using PrinterAgent.Core.Classification;
using PrinterAgent.Core.Discovery.Ipp;
using PrinterAgent.Core.Models;
using PrinterAgent.Core.Snmp;
using PrinterAgent.Core.Vendors;
using DeviceType = PrinterAgent.Core.Classification.DeviceType;

namespace PrinterAgent.Core.Discovery;

/// <summary>
/// Probes one host with every available protocol (SNMP, IPP, TCP ports,
/// ARP, mDNS, OUI), merges what each one found, and asks
/// <see cref="DeviceClassifier"/> whether the result is actually a printer
/// before returning anything — a single protocol failing never rules a
/// host out, and a single protocol answering never rules it in by itself.
/// </summary>
public class DeviceProbeOrchestrator
{
    private readonly SnmpDeviceReader _snmpReader;
    private readonly IppClient _ippClient;
    private readonly ModelDatabase _modelDatabase;
    private readonly ILogger<DeviceProbeOrchestrator> _logger;

    public DeviceProbeOrchestrator(
        SnmpDeviceReader snmpReader, IppClient ippClient, ModelDatabase modelDatabase, ILogger<DeviceProbeOrchestrator> logger)
    {
        _snmpReader = snmpReader;
        _ippClient = ippClient;
        _modelDatabase = modelDatabase;
        _logger = logger;
    }

    public async Task<ProbeOutcome> ProbeAsync(
        IPAddress ip, string community, int snmpTimeoutMs, int snmpRetries, int auxTimeoutMs,
        IReadOnlyDictionary<string, List<string>> mdnsResults, IReadOnlyDictionary<string, List<string>> wsDiscoveryResults, CancellationToken ct)
    {
        var ipText = ip.ToString();
        // ConcurrentDictionary, not Dictionary — snmpTask and ippTask below
        // write to this from two different tasks running in parallel via
        // Task.WhenAll. A plain Dictionary corrupted by concurrent writes
        // can spin forever inside its own internals instead of throwing,
        // which is exactly what made scans appear to freeze partway through
        // (every host that happened to race here permanently occupied one
        // of PrinterDiscoveryService's limited concurrency slots).
        var diagnostics = new ConcurrentDictionary<string, string>();

        var snmpTask = SafeAsync(() => _snmpReader.ProbeAsync(ip, community, snmpTimeoutMs, snmpRetries, ct), "snmp", diagnostics, _logger);
        var ippTask = SafeAsync(async () => (IppProbeResult?)await _ippClient.ProbeAsync(ipText, auxTimeoutMs, ct), "ipp", diagnostics, _logger);
        var portsTask = TcpPortProbe.ProbeAsync(ipText, auxTimeoutMs, ct);

        // Race the whole group against a hard ceiling instead of a bare
        // `await Task.WhenAll(...)` — SnmpDeviceReader's SNMP calls run via
        // Task.Run wrapping SharpSnmpLib's synchronous socket I/O, which
        // does NOT reliably abort just because a CancellationToken was
        // passed to Task.Run (that only stops it from *starting* if already
        // cancelled, not a running call). If that blocking call hangs for
        // any reason, a plain WhenAll would wait on it forever and this
        // host would permanently occupy one of PrinterDiscoveryService's
        // limited concurrency slots — exactly the "gets stuck partway
        // through" symptom this replaces. Whichever task(s) haven't
        // finished when the ceiling hits are simply abandoned (they'll
        // finish or get GC'd on their own later) and treated as
        // "not available" for this round, same as a real timeout.
        var overallTask = Task.WhenAll(snmpTask, ippTask, portsTask);
        var ceilingMs = Math.Max(5000, auxTimeoutMs * 3);
        var winner = await Task.WhenAny(overallTask, Task.Delay(ceilingMs, ct));

        var snmp = snmpTask.IsCompletedSuccessfully ? snmpTask.Result : null;
        var ipp = ippTask.IsCompletedSuccessfully ? ippTask.Result : null;
        var openPorts = portsTask.IsCompletedSuccessfully ? portsTask.Result : [];
        if (winner != overallTask)
        {
            diagnostics["timeout"] = "host_probe_exceeded_ceiling";
            _logger.LogDebug("{Ip} exceeded the {CeilingMs}ms probe ceiling — using whatever completed so far", ipText, ceilingMs);
        }
        diagnostics["tcp_ports"] = openPorts.Count > 0 ? "success" : "not_available";

        // Fase 9 (diagnóstico) — SnmpDeviceReader already determines these
        // two booleans internally (used by the classifier), but they were
        // discarded once classification was done — this is what turns a
        // silent "counter: null" into something diagnosable: "SNMP
        // responded, but this specific table came back empty" is a very
        // different situation from "SNMP never responded at all" (already
        // covered by diagnostics["snmp"]), and a technician staring at a
        // printer with no counters needs to know which one it is. Only set
        // when SNMP responded at all — when it didn't, diagnostics["snmp"]
        // already explains the absence, a redundant "not_available" here
        // wouldn't add information.
        if (snmp is not null)
        {
            diagnostics["counters"] = snmp.PrinterMibCountersFound ? "success" : "table_empty";
            diagnostics["supplies"] = snmp.PrinterMibSuppliesFound ? "success" : "table_empty";
        }

        var mac = snmp?.Device.Mac ?? ArpResolver.ResolveMac(ip);
        diagnostics["arp"] = mac is not null ? "success" : "not_available";

        var mdnsServices = mdnsResults.GetValueOrDefault(ipText) ?? [];
        diagnostics["mdns"] = mdnsServices.Count > 0 ? "success" : "not_available";

        // Fase 12 (WS-Discovery) — same "one multicast query for the whole
        // sweep, not per host" shape as mDNS above; DeviceClassifier is what
        // actually decides whether the advertised Types mean anything (see
        // its own comment — responding at all is never enough by itself).
        var wsDiscoveryTypes = wsDiscoveryResults.GetValueOrDefault(ipText) ?? [];
        diagnostics["ws_discovery"] = wsDiscoveryTypes.Count > 0 ? "success" : "not_available";

        var (ouiVendor, isPrinterVendor, isInfraVendor) = OuiVendorLookup.Lookup(mac);

        var signals = new DeviceSignals
        {
            SysDescr = snmp?.Device.SysDescr,
            PrinterMibGeneralFound = snmp?.PrinterMibGeneralFound ?? false,
            PrinterMibCountersFound = snmp?.PrinterMibCountersFound ?? false,
            PrinterMibSuppliesFound = snmp?.PrinterMibSuppliesFound ?? false,
            Ipp = ipp,
            OpenTcpPorts = openPorts,
            MdnsServices = mdnsServices,
            WsDiscoveryTypes = wsDiscoveryTypes,
            OuiVendor = ouiVendor,
            OuiIsKnownPrinterVendor = isPrinterVendor,
            OuiIsKnownInfraVendor = isInfraVendor,
        };

        var classification = DeviceClassifier.Classify(signals);
        // Fase 8 (telemetria) — SNMP/IPP outcomes are reported for EVERY
        // host probed, not just ones that turned out to be printers, so
        // PrinterDiscoveryService can aggregate real per-cycle counters
        // (snmp_success/failure, ipp_success/failure) instead of only ever
        // seeing the subset that got classified as a printer.
        var snmpResponded = snmp is not null;
        var ippResponded = ipp is { Responded: true };
        if (classification.Type is not (DeviceType.Printer or DeviceType.Mfp or DeviceType.Plotter))
        {
            _logger.LogDebug("{Ip} classified as {Type} (confidence {Confidence:0.00}) — not a printer", ipText, classification.Type, classification.Confidence);
            return new ProbeOutcome(null, snmpResponded, ippResponded, classification.Type != DeviceType.Unknown);
        }

        var device = snmp?.Device ?? new DiscoveredDevice { Ip = ipText };
        device.Mac ??= mac;
        device.CollectionMethod ??= "SNMP";

        MergeIppData(device, ipp, modelFromPrinterMib: snmp?.ModelFromPrinterMib ?? false);

        // Must run against the RAW model string, before the display-name
        // rewrite below replaces it — only fires for a specifically
        // identified unit (exact match), never a fuzzy family guess.
        if (device.Capabilities.Color is null)
        {
            var colorHint = _modelDatabase.LookupColorHint(device.Manufacturer, device.Model);
            if (colorHint is not null)
            {
                device.Capabilities.Color = colorHint;
                device.CapabilitySources["color"] = "model_database";
            }
        }
        if (device.Capabilities.Copy is null)
        {
            var copyHint = _modelDatabase.LookupCopyHint(device.Manufacturer, device.Model);
            if (copyHint is not null)
            {
                device.Capabilities.Copy = copyHint;
                device.CapabilitySources["copy"] = "model_database";
            }
        }
        if (device.Capabilities.Scan is null)
        {
            var scanHint = _modelDatabase.LookupScanHint(device.Manufacturer, device.Model);
            if (scanHint is not null)
            {
                device.Capabilities.Scan = scanHint;
                device.CapabilitySources["scan"] = "model_database";
            }
        }
        if (device.Capabilities.Fax is null)
        {
            var faxHint = _modelDatabase.LookupFaxHint(device.Manufacturer, device.Model);
            if (faxHint is not null)
            {
                device.Capabilities.Fax = faxHint;
                device.CapabilitySources["fax"] = "model_database";
            }
        }

        // A device with a single marker (no per-colorant breakdown
        // available — see SnmpDeviceReader.ReadCountersAsync) only ever
        // fills Counters.Total, leaving BlackWhite/Color null even though,
        // once color is CONFIRMED false, the total can only be black & white
        // pages by definition. This is a deduction from a confirmed fact
        // (color: false), not a guess — it never fires when color is merely
        // unconfirmed (null), only when a real source said "no color".
        if (device.Capabilities.Color == false && device.Counters is { Total: not null, BlackWhite: null, Color: null })
        {
            device.Counters.BlackWhite = device.Counters.Total;
        }

        // Some devices report a compact internal code instead of the name
        // printed on the unit (e.g. Samsung's SL-M4070FR reports
        // "SAMSUNGM4070" over SNMP/IPP) — only rewritten on an exact,
        // confirmed match in the model database; anything else keeps
        // exactly what the device itself reported.
        var displayName = _modelDatabase.LookupDisplayName(device.Manufacturer, device.Model);
        if (displayName is not null)
        {
            device.Model = displayName;
        }

        // Resolve the vendor provider now that a manufacturer is known —
        // scaffold only in this phase (see Vendors/VendorProviders.cs), but
        // resolving it here keeps the extension point wired into the real
        // pipeline instead of sitting unused.
        _ = VendorProviderRegistry.Resolve(device.Manufacturer);

        var typeHint = _modelDatabase.LookupDeviceTypeHint(device.Manufacturer, device.Model);
        var finalType = typeHint is DeviceType.Mfp or DeviceType.Plotter ? typeHint.Value : classification.Type;
        if (finalType == DeviceType.Printer && ipp?.MakeAndModel?.Contains("MFP", StringComparison.OrdinalIgnoreCase) == true)
        {
            finalType = DeviceType.Mfp;
        }

        device.DeviceType = finalType.ToString().ToUpperInvariant();
        device.ClassificationConfidence = classification.Confidence;
        device.ClassificationEvidence = classification.Evidence.Select(e => e.ToString()).ToList();
        device.Diagnostics = new Dictionary<string, string>(diagnostics);

        return new ProbeOutcome(device, snmpResponded, ippResponded, Classified: true);
    }

    internal static void MergeIppData(DiscoveredDevice device, IppProbeResult? ipp, bool modelFromPrinterMib)
    {
        if (ipp is not { Responded: true })
        {
            return;
        }

        // Priority for Model: real Printer-MIB prtGeneralPrinterName > IPP's
        // printer-make-and-model > sysDescr-parsing fallback (ExtractModel).
        // The fallback is a crude heuristic that ALWAYS produces something
        // non-empty (e.g. "ETHERNET MULTI-ENVIRONMENT..." from an HP
        // JetDirect card's sysDescr) — checking "is Model empty" here would
        // never be true once that fallback already ran, so IPP's better
        // answer would never get a chance to override it. modelFromPrinterMib
        // is what actually gates this, not string emptiness.
        if (!modelFromPrinterMib && !string.IsNullOrWhiteSpace(ipp.MakeAndModel))
        {
            device.Model = ipp.MakeAndModel;
        }
        if (string.IsNullOrWhiteSpace(device.Manufacturer) && !string.IsNullOrWhiteSpace(ipp.MakeAndModel))
        {
            device.Manufacturer = Snmp.PrinterMibOids.KnownManufacturers
                .FirstOrDefault(m => ipp.MakeAndModel!.Contains(m, StringComparison.OrdinalIgnoreCase));
        }

        // Printer-MIB (via DetectSupportsA3Async/DetectSupportsDuplexAsync)
        // already set A3/Duplex when it could; IPP only fills in what SNMP
        // didn't determine. Color has no Printer-MIB source in this phase,
        // so IPP is the only source for it.
        if (ipp.ColorSupported is not null)
        {
            device.Capabilities.Color = ipp.ColorSupported;
            device.CapabilitySources["color"] = "ipp";
        }
        if (device.Capabilities.Duplex is null && ipp.DuplexSupported is not null)
        {
            device.Capabilities.Duplex = ipp.DuplexSupported;
            device.CapabilitySources["duplex"] = "ipp";
        }
        if (device.Capabilities.A3 is null && ipp.A3Supported is not null)
        {
            device.Capabilities.A3 = ipp.A3Supported;
            device.SupportsA3 = ipp.A3Supported;
            device.CapabilitySources["a3"] = "ipp";
        }

        // Fase 13 (IPP avançado) — IPP-only fields, no Printer-MIB
        // equivalent in this codebase, so there's no "which source wins"
        // question here.
        device.PrinterState = ipp.PrinterState;
        device.MediaReady = ipp.MediaReady;

        // printer-supply/-description only fills in consumables the
        // Printer-MIB supplies table (SnmpDeviceReader.ReadSuppliesAsync)
        // didn't find at all — SNMP stays the preferred source (it also
        // gives colorant/type detail IPP's simpler encoding may not), same
        // gap-fill priority already used for Duplex/A3 above.
        if ((device.Consumables is null or { Count: 0 }) && ipp.Supplies is { Count: > 0 })
        {
            device.Consumables = ipp.Supplies
                .Where(s => !string.IsNullOrWhiteSpace(s.Description) || !string.IsNullOrWhiteSpace(s.Type))
                .Select(s => new DeviceConsumable
                {
                    Type = s.Type ?? "other",
                    Color = s.ColorantName?.ToLowerInvariant(),
                    Name = s.Description,
                    LevelPercent = s is { Level: not null, MaxCapacity: > 0 }
                        ? Math.Round(s.Level.Value * 100.0 / s.MaxCapacity.Value, 1)
                        : null,
                    Capacity = s.MaxCapacity?.ToString(),
                })
                .ToList();
            if (device.Consumables.Count > 0)
            {
                device.CapabilitySources["supplies"] = "ipp";
            }
        }

        // printer-state-reasons folded into the same alert pipeline as
        // Printer-MIB's prtAlertTable and the Fase 11 cover-open synthetic
        // alerts — reusing it instead of adding a separate surface for what
        // is, functionally, the same kind of information from a different
        // protocol. Severity comes straight from the RFC 8011 §5.4.12
        // suffix convention ("-error"/"-warning"/"-report"), never guessed.
        if (ipp.PrinterStateReasons is { Count: > 0 })
        {
            var stateReasonAlerts = ipp.PrinterStateReasons.Select(reason => new DeviceAlert
            {
                Code = reason,
                Description = HumanizeStateReason(reason),
                Severity = reason switch
                {
                    _ when reason.EndsWith("-error", StringComparison.OrdinalIgnoreCase) => "critical",
                    _ when reason.EndsWith("-warning", StringComparison.OrdinalIgnoreCase) => "warning",
                    _ => null,
                },
            }).ToList();
            device.Alerts = device.Alerts is null ? stateReasonAlerts : [.. device.Alerts, .. stateReasonAlerts];
        }
    }

    /// <summary>"media-jam-error" → "media jam" — strips the RFC 8011 severity suffix and turns hyphens into spaces; purely cosmetic, the Code field keeps the exact keyword the device reported.</summary>
    private static string HumanizeStateReason(string reason)
    {
        var withoutSuffix = reason switch
        {
            _ when reason.EndsWith("-error", StringComparison.OrdinalIgnoreCase) => reason[..^"-error".Length],
            _ when reason.EndsWith("-warning", StringComparison.OrdinalIgnoreCase) => reason[..^"-warning".Length],
            _ when reason.EndsWith("-report", StringComparison.OrdinalIgnoreCase) => reason[..^"-report".Length],
            _ => reason,
        };
        return withoutSuffix.Replace('-', ' ');
    }

    private static async Task<T?> SafeAsync<T>(Func<Task<T?>> probe, string name, ConcurrentDictionary<string, string> diagnostics, ILogger logger) where T : class
    {
        try
        {
            var result = await probe();
            diagnostics[name] = result is not null ? "success" : "not_available";
            return result;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "{Probe} probe failed", name);
            diagnostics[name] = "failed";
            return null;
        }
    }
}

/// <summary>
/// Fase 8 (telemetria) — what a single host probe found, whether or not it
/// ended up classified as a printer. <see cref="Device"/> is null for any
/// host that wasn't (same meaning as the old bare-nullable return this
/// replaced); the three flags let the caller aggregate per-cycle counters
/// across every host, not just the ones that made it into the result list.
/// </summary>
public record ProbeOutcome(DiscoveredDevice? Device, bool SnmpResponded, bool IppResponded, bool Classified);
