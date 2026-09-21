using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using PrinterAgent.Core.Models;

namespace PrinterAgent.ConfigTool;

public partial class PrinterDetailsWindow : Window
{
    private const string NotAvailable = "Não disponível";

    public PrinterDetailsWindow(AgentContext context, string printerId)
    {
        InitializeComponent();
        TitleText.Text = "Carregando...";
        _ = LoadAsync(context, printerId);
    }

    private async Task LoadAsync(AgentContext context, string printerId)
    {
        var detail = await context.ApiClient.GetPrinterAsync(printerId, CancellationToken.None);
        if (detail is null)
        {
            TitleText.Text = "Não foi possível carregar os detalhes desta impressora.";
            return;
        }

        TitleText.Text = detail.Model ?? detail.Hostname ?? detail.Ip ?? "Impressora";

        AddSectionHeader("Identificação");
        AddRow("Fabricante", detail.Manufacturer);
        AddRow("Modelo", detail.Model);
        AddRow("Número de série", detail.Serial);
        AddRow("Endereço IP", detail.Ip);
        AddRow("Endereço MAC", detail.Mac);
        AddRow("Hostname", detail.Hostname);
        AddRow("Firmware", detail.Firmware);
        AddRow("Tipo de conexão", detail.CollectionMethod == "MANUAL" ? "Manual" : "Rede (SNMP)");

        AddSectionHeader("Status");
        AddRow("Monitorada", detail.Status == "MONITORED" ? "Sim" : "Não");
        AddRow("Situação", detail.OnlineStatus == "ONLINE" ? "Online" : detail.OnlineStatus == "OFFLINE" ? "Offline" : "Desconhecida");
        AddRow("Última comunicação", detail.LastSeenAt?.ToLocalTime().ToString("dd/MM/yyyy HH:mm"));
        AddRow("Monitorando desde", detail.MonitoredAt?.ToLocalTime().ToString("dd/MM/yyyy HH:mm"));

        AddSectionHeader("Contadores (última leitura)");
        var lastCounter = detail.Counters?.FirstOrDefault();
        if (lastCounter is null)
        {
            AddRow("Contadores", NotAvailable);
        }
        else
        {
            AddRow("Total", lastCounter.Total?.ToString());
            AddRow("Preto e branco", lastCounter.BlackWhite?.ToString());
            AddRow("Colorida", lastCounter.Color?.ToString());
            AddRow("Cópias", lastCounter.Copies?.ToString());
            AddRow("Coletado em", lastCounter.CollectedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm"));
        }

        AddSectionHeader("Suprimentos (última leitura)");
        if (detail.Consumables is not { Count: > 0 })
        {
            AddRow("Suprimentos", NotAvailable);
        }
        else
        {
            foreach (var c in detail.Consumables.Take(10))
            {
                var label = c.Color is null ? c.Type : $"{c.Type} ({c.Color})";
                AddRow(label, c.LevelPercent is null ? NotAvailable : $"{c.LevelPercent:0}%");
            }
        }
    }

    private void AddSectionHeader(string text)
    {
        ContentPanel.Children.Add(new TextBlock
        {
            Text = text,
            FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 16, 0, 6),
        });
    }

    private void AddRow(string label, string? value)
    {
        var row = new Grid { Margin = new Thickness(0, 0, 0, 4) };
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(160) });
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        var labelBlock = new TextBlock { Text = label, Foreground = (Brush)FindResource("MutedBrush") };
        Grid.SetColumn(labelBlock, 0);

        var valueBlock = new TextBlock
        {
            Text = string.IsNullOrWhiteSpace(value) ? NotAvailable : value,
            TextWrapping = TextWrapping.Wrap,
        };
        Grid.SetColumn(valueBlock, 1);

        row.Children.Add(labelBlock);
        row.Children.Add(valueBlock);
        ContentPanel.Children.Add(row);
    }
}
