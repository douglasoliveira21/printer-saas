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

    public async Task<DiscoveredDevice?> ProbeAsync(
        IPAddress ip, string community, int snmpTimeoutMs, int snmpRetries, int auxTimeoutMs,
        IReadOnlyDictionary<string, List<string>> mdnsResults, CancellationToken ct)
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

        var mac = snmp?.Device.Mac ?? ArpResolver.ResolveMac(ip);
        diagnostics["arp"] = mac is not null ? "success" : "not_available";

        var mdnsServices = mdnsResults.GetValueOrDefault(ipText) ?? [];
        diagnostics["mdns"] = mdnsServices.Count > 0 ? "success" : "not_available";

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
            OuiVendor = ouiVendor,
            OuiIsKnownPrinterVendor = isPrinterVendor,
            OuiIsKnownInfraVendor = isInfraVendor,
        };

        var classification = DeviceClassifier.Classify(signals);
        if (classification.Type is not (DeviceType.Printer or DeviceType.Mfp or DeviceType.Plotter))
        {
            _logger.LogDebug("{Ip} classified as {Type} (confidence {Confidence:0.00}) — not a printer", ipText, classification.Type, classification.Confidence);
            return null;
        }

        var device = snmp?.Device ?? new DiscoveredDevice { Ip = ipText };
        device.Mac ??= mac;
        device.CollectionMethod ??= "SNMP";

        MergeIppData(device, ipp);

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

        return device;
    }

    private static void MergeIppData(DiscoveredDevice device, IppProbeResult? ipp)
    {
        if (ipp is not { Responded: true })
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(device.Model) && !string.IsNullOrWhiteSpace(ipp.MakeAndModel))
        {
            device.Model = ipp.MakeAndModel;
        }
        if (string.IsNullOrWhiteSpace(device.Manufacturer) && !string.IsNullOrWhiteSpace(ipp.MakeAndModel))
        {
            device.Manufacturer = Snmp.PrinterMibOids.KnownManufacturers
                .FirstOrDefault(m => ipp.MakeAndModel!.Contains(m, StringComparison.OrdinalIgnoreCase));
        }

        // IPP > Printer-MIB > model database priority — Printer-MIB (via
        // DetectSupportsA3Async) already set A3 when it could; IPP only
        // fills in what SNMP didn't determine. Color/duplex have no
        // Printer-MIB source in this phase, so IPP is the only source.
        if (ipp.ColorSupported is not null)
        {
            device.Capabilities.Color = ipp.ColorSupported;
            device.CapabilitySources["color"] = "ipp";
        }
        if (ipp.DuplexSupported is not null)
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
