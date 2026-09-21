using System.ComponentModel;
using System.Runtime.CompilerServices;
using PrinterAgent.Core.Models;

namespace PrinterAgent.ConfigTool;

public class PrinterRow(AgentPrinterSummary printer) : INotifyPropertyChanged
{
    public AgentPrinterSummary Printer { get; } = printer;

    private bool _isSelected;
    public bool IsSelected
    {
        get => _isSelected;
        set { _isSelected = value; OnPropertyChanged(); }
    }

    public string Id => Printer.Id;
    public bool IsMonitored => Printer.Status == "MONITORED";
    public string MonitoredLabel => IsMonitored ? "✔" : "—";
    public string StatusLabel => Printer.Status switch
    {
        "MONITORED" => "Monitorada",
        "IGNORED" => "Desativada",
        "DECOMMISSIONED" => "Decomissionada",
        _ => "Pendente",
    };
    public string OnlineLabel => Printer.OnlineStatus switch
    {
        "ONLINE" => "Online",
        "OFFLINE" => "Offline",
        _ => "Desconhecida",
    };
    public string ConnectionLabel => Printer.CollectionMethod == "MANUAL" ? "Manual" : "Rede";
    public string HomologadoLabel => IsMonitored ? "Sim" : "Não";
    public string Ip => Printer.Ip ?? "—";
    public string Mac => Printer.Mac ?? "—";
    public string Manufacturer => Printer.Manufacturer ?? "—";
    public string Model => Printer.Model ?? "—";
    public string Serial => Printer.Serial ?? "—";

    public bool Matches(string filter) =>
        string.IsNullOrWhiteSpace(filter) ||
        $"{Ip} {Manufacturer} {Model} {Serial} {Mac}".Contains(filter, StringComparison.OrdinalIgnoreCase);

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
