using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using PrinterAgent.Core.Models;

namespace PrinterAgent.ConfigTool;

public partial class PrintersTabView : UserControl
{
    private AgentContext? _context;
    private readonly ObservableCollection<PrinterRow> _rows = [];
    private ICollectionView? _view;

    public PrintersTabView()
    {
        InitializeComponent();
        _view = CollectionViewSource.GetDefaultView(_rows);
        _view.Filter = o => o is PrinterRow row && row.Matches(FilterTextBox.Text);
        PrintersGrid.ItemsSource = _view;
    }

    public void Initialize(AgentContext context)
    {
        _context = context;
    }

    public async Task RefreshAsync()
    {
        if (_context is null) return;

        StatusText.Text = "Carregando impressoras...";
        var printers = await _context.ApiClient.ListPrintersAsync(CancellationToken.None);
        _rows.Clear();
        foreach (var p in printers)
        {
            _rows.Add(new PrinterRow(p));
        }
        StatusText.Text = "";
        RegisteredCountText.Text = $"Impressoras cadastradas: {_rows.Count}";
        MonitoredCountText.Text = $"Impressoras monitoradas: {_rows.Count(r => r.IsMonitored)}";
    }

    private void FilterTextBox_TextChanged(object sender, TextChangedEventArgs e) => _view?.Refresh();

    private async void RefreshButton_Click(object sender, RoutedEventArgs e) => await RefreshAsync();

    private async void MonitorButton_Click(object sender, RoutedEventArgs e)
    {
        if (_context is null) return;
        var ids = SelectedIds();
        if (ids.Count == 0)
        {
            StatusText.Text = "Selecione ao menos uma impressora.";
            return;
        }
        await _context.ApiClient.MonitorPrintersAsync(ids, CancellationToken.None);
        await RefreshAsync();
    }

    private async void DeactivateButton_Click(object sender, RoutedEventArgs e)
    {
        if (_context is null) return;
        var ids = SelectedIds();
        if (ids.Count == 0)
        {
            StatusText.Text = "Selecione ao menos uma impressora.";
            return;
        }
        await _context.ApiClient.DeactivatePrintersAsync(ids, CancellationToken.None);
        await RefreshAsync();
    }

    private async void RemoveButton_Click(object sender, RoutedEventArgs e)
    {
        if (_context is null) return;
        var ids = SelectedIds();
        if (ids.Count == 0)
        {
            StatusText.Text = "Selecione ao menos uma impressora.";
            return;
        }
        var confirm = MessageBox.Show(
            Window.GetWindow(this), $"Remover {ids.Count} impressora(s)? Só funciona para as ainda não monitoradas.",
            "Printer SaaS Agent", MessageBoxButton.YesNo, MessageBoxImage.Question);
        if (confirm != MessageBoxResult.Yes) return;

        var errors = new List<string>();
        var removed = 0;
        foreach (var id in ids)
        {
            var row = _rows.FirstOrDefault(r => r.Id == id);
            var error = await _context.ApiClient.DeletePrinterAsync(id, CancellationToken.None);
            if (error is not null)
            {
                // Identify WHICH printer failed (IP) — several selected rows
                // can fail for different reasons, and a bare deduplicated
                // message list previously hid that.
                errors.Add($"{row?.Ip ?? id}: {error}");
            }
            else
            {
                removed++;
            }
        }
        if (errors.Count > 0)
        {
            var summary = removed > 0 ? $"{removed} removida(s). Falhas:\n" : "";
            MessageBox.Show(Window.GetWindow(this), summary + string.Join("\n", errors), "Printer SaaS Agent", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        await RefreshAsync();
    }

    private async void AddButton_Click(object sender, RoutedEventArgs e)
    {
        if (_context is null) return;
        var dialog = new AddPrinterDialog(_context) { Owner = Window.GetWindow(this) };
        if (dialog.ShowDialog() == true && dialog.Result is not null)
        {
            await _context.ApiClient.SubmitDevicesAsync(new SubmitDevicesRequest { Devices = [dialog.Result] }, CancellationToken.None);
            await RefreshAsync();
        }
    }

    private void DetailsButton_Click(object sender, RoutedEventArgs e)
    {
        if (_context is null) return;
        if (sender is Button { Tag: string id })
        {
            var window = new PrinterDetailsWindow(_context, id) { Owner = Window.GetWindow(this) };
            window.ShowDialog();
        }
    }

    private List<string> SelectedIds() => _rows.Where(r => r.IsSelected).Select(r => r.Id).ToList();
}
