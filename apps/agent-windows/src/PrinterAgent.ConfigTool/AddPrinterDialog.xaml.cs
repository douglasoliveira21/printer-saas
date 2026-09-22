using System.Net;
using System.Windows;
using PrinterAgent.Core.Models;

namespace PrinterAgent.ConfigTool;

public partial class AddPrinterDialog : Window
{
    private readonly AgentContext _context;

    /// <summary>Set on success — the caller submits this to the SaaS.</summary>
    public DiscoveredDevice? Result { get; private set; }

    public AddPrinterDialog(AgentContext context)
    {
        InitializeComponent();
        _context = context;
    }

    private async void AddButton_Click(object sender, RoutedEventArgs e)
    {
        var ipText = IpTextBox.Text.Trim();
        if (!IPAddress.TryParse(ipText, out var ip))
        {
            StatusText.Text = "Informe um endereço IP válido.";
            return;
        }

        var community = string.IsNullOrWhiteSpace(CommunityTextBox.Text) ? "public" : CommunityTextBox.Text.Trim();

        AddButton.IsEnabled = false;
        StatusText.Text = "Consultando a impressora via SNMP...";
        try
        {
            // Manual add bypasses the multi-protocol classifier on purpose —
            // the operator already knows this IP is a printer, so plain
            // SNMP data (whatever this device reports) is enough here.
            var probe = await _context.SnmpReader.ProbeAsync(ip, community, 2000, 2, CancellationToken.None);
            if (probe is null)
            {
                StatusText.Text = "Não foi possível ler dados SNMP desse endereço. Verifique o IP e a community.";
                return;
            }
            var device = probe.Device;
            device.CollectionMethod = "MANUAL";
            Result = device;
            DialogResult = true;
            Close();
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Falha: {ex.Message}";
        }
        finally
        {
            AddButton.IsEnabled = true;
        }
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }
}
