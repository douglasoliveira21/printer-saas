using PrinterAgent.Core.Classification;
using PrinterAgent.Core.Discovery;
using PrinterAgent.Core.Models;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Fase 13 (IPP avançado) — cobre como DeviceProbeOrchestrator.MergeIppData
/// integra printer-state/-reasons/printer-supply/media-ready no
/// DiscoveredDevice: printer-supply só preenche o que o SNMP não achou
/// (mesma prioridade já usada pra Duplex/A3), e printer-state-reasons vira
/// alerta reaproveitando o pipeline já existente (mesmo padrão da Fase 11
/// pra prtCoverTable), nunca substituindo um alerta SNMP real.
/// </summary>
public class DeviceProbeOrchestratorIppMergeTests
{
    [Fact]
    public void Printer_supply_do_IPP_so_preenche_quando_SNMP_nao_achou_nenhum_consumivel()
    {
        var device = new DiscoveredDevice { Consumables = null };
        var ipp = new IppProbeResult
        {
            Responded = true,
            Supplies = [new IppSupply { Type = "toner", Level = 45, MaxCapacity = 100, ColorantName = "black", Description = "Black Toner" }],
        };

        DeviceProbeOrchestrator.MergeIppData(device, ipp, modelFromPrinterMib: false);

        var consumable = Assert.Single(device.Consumables!);
        Assert.Equal("toner", consumable.Type);
        Assert.Equal("black", consumable.Color);
        Assert.Equal(45.0, consumable.LevelPercent);
        Assert.Equal("supplies", device.CapabilitySources.Keys.Single());
        Assert.Equal("ipp", device.CapabilitySources["supplies"]);
    }

    [Fact]
    public void Printer_supply_do_IPP_NUNCA_sobrescreve_consumiveis_ja_lidos_via_SNMP()
    {
        var existing = new List<DeviceConsumable> { new() { Type = "toner", Name = "SNMP Toner Reading" } };
        var device = new DiscoveredDevice { Consumables = existing };
        var ipp = new IppProbeResult
        {
            Responded = true,
            Supplies = [new IppSupply { Type = "ink", Description = "IPP Should Not Win" }],
        };

        DeviceProbeOrchestrator.MergeIppData(device, ipp, modelFromPrinterMib: false);

        Assert.Same(existing, device.Consumables);
        Assert.Equal("SNMP Toner Reading", device.Consumables![0].Name);
    }

    [Fact]
    public void Printer_state_reasons_vira_alerta_com_severidade_pelo_sufixo_RFC8011()
    {
        var device = new DiscoveredDevice();
        var ipp = new IppProbeResult
        {
            Responded = true,
            PrinterStateReasons = ["media-jam-error", "cover-open-warning", "moving-to-paused-report"],
        };

        DeviceProbeOrchestrator.MergeIppData(device, ipp, modelFromPrinterMib: false);

        Assert.Equal(3, device.Alerts!.Count);
        Assert.Equal("critical", device.Alerts.Single(a => a.Code == "media-jam-error").Severity);
        Assert.Equal("warning", device.Alerts.Single(a => a.Code == "cover-open-warning").Severity);
        Assert.Null(device.Alerts.Single(a => a.Code == "moving-to-paused-report").Severity);
    }

    [Fact]
    public void Printer_state_reasons_soma_aos_alertas_ja_existentes_do_SNMP_sem_apagar_eles()
    {
        var device = new DiscoveredDevice
        {
            Alerts = [new DeviceAlert { Code = "1.3.6.1.4.1.x", Description = "SNMP alert", Severity = "warning" }],
        };
        var ipp = new IppProbeResult { Responded = true, PrinterStateReasons = ["media-jam-error"] };

        DeviceProbeOrchestrator.MergeIppData(device, ipp, modelFromPrinterMib: false);

        Assert.Equal(2, device.Alerts!.Count);
        Assert.Contains(device.Alerts, a => a.Description == "SNMP alert");
        Assert.Contains(device.Alerts, a => a.Code == "media-jam-error");
    }

    [Fact]
    public void Printer_state_e_media_ready_sao_copiados_direto_sem_interpretacao()
    {
        var device = new DiscoveredDevice();
        var ipp = new IppProbeResult { Responded = true, PrinterState = "processing", MediaReady = ["na_letter_8.5x11in"] };

        DeviceProbeOrchestrator.MergeIppData(device, ipp, modelFromPrinterMib: false);

        Assert.Equal("processing", device.PrinterState);
        Assert.Equal(["na_letter_8.5x11in"], device.MediaReady);
    }

    [Fact]
    public void IPP_nao_respondeu_nao_altera_nada_no_device()
    {
        var device = new DiscoveredDevice { PrinterState = null, MediaReady = null };

        DeviceProbeOrchestrator.MergeIppData(device, new IppProbeResult { Responded = false }, modelFromPrinterMib: false);

        Assert.Null(device.PrinterState);
        Assert.Null(device.MediaReady);
        Assert.Null(device.Alerts);
    }
}
