using System.Windows;
using System.Windows.Controls;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Models;

namespace PrinterAgent.ConfigTool;

public partial class ToolsTabView : UserControl
{
    private AgentContext? _context;
    private readonly UsbPrinterDiscoveryService _usbDiscovery = new();

    public ToolsTabView()
    {
        InitializeComponent();
    }

    public void Initialize(AgentContext context)
    {
        _context = context;
    }

    private async void NetworkScanButton_Click(object sender, RoutedEventArgs e)
    {
        if (_context is null) return;
        NetworkScanButton.IsEnabled = false;
        NetworkScanStatus.Text = "Buscando...";
        try
        {
            var networksCsv = _context.Installer.GetConfiguredNetworks();
            var networks = string.IsNullOrWhiteSpace(networksCsv)
                ? []
                : networksCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

            var options = new AgentOptions
            {
                Networks = networks,
                SnmpCommunity = _context.Installer.GetConfiguredSnmpCommunity(),
            };

            var devices = await _context.DiscoveryService.ScanAsync(options, CancellationToken.None);
            if (devices.Count == 0)
            {
                NetworkScanStatus.Text = "Nenhum dispositivo foi classificado como impressora nas redes configuradas.";
                return;
            }

            await _context.ApiClient.SubmitDevicesAsync(new SubmitDevicesRequest { Devices = devices }, CancellationToken.None);
            NetworkScanStatus.Text = $"{devices.Count} impressora(s) encontrada(s) e enviada(s) ao SaaS.";
        }
        catch (Exception ex)
        {
            NetworkScanStatus.Text = $"Falha na busca: {ex.Message}";
        }
        finally
        {
            NetworkScanButton.IsEnabled = true;
        }
    }

    private void UsbScanButton_Click(object sender, RoutedEventArgs e)
    {
        var found = _usbDiscovery.Scan();
        UsbResultsList.ItemsSource = found;
    }

    private async void AddUsbPrinter_Click(object sender, RoutedEventArgs e)
    {
        if (_context is null) return;
        if (sender is not Button { Tag: UsbPrinter printer }) return;

        var device = new DiscoveredDevice
        {
            // USB printers have no serial/MAC/IP the API can fingerprint on —
            // the Windows queue name is the closest stable identity available,
            // so it doubles as the dedup key (see computeFingerprint in
            // AgentsService — serial takes priority over mac/ip).
            Serial = $"usb:{printer.Name}",
            Hostname = printer.Name,
            Model = printer.Name,
            SysDescr = printer.DriverName,
            CollectionMethod = "MANUAL",
        };
        await _context.ApiClient.SubmitDevicesAsync(new SubmitDevicesRequest { Devices = [device] }, CancellationToken.None);
        MessageBox.Show(Window.GetWindow(this), $"\"{printer.Name}\" adicionada. Veja na aba Impressoras.", "Printer SaaS Agent", MessageBoxButton.OK, MessageBoxImage.Information);
    }
}
