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
    public string StatusLabel => Printer.Status switch
    {
        "MONITORED" => "Homologada / monitorada",
        "IGNORED" => "Desativada",
        "DECOMMISSIONED" => "Decomissionada",
        _ => "Pendente (não monitorada)",
    };
    public string OnlineLabel => Printer.OnlineStatus switch
    {
        "ONLINE" => "Online",
        "OFFLINE" => "Offline",
        _ => "Desconhecida",
    };
    public string ConnectionLabel => Printer.CollectionMethod == "MANUAL" ? "Manual" : "Rede (SNMP)";
    public string Ip => Printer.Ip ?? "—";
    public string Mac => Printer.Mac ?? "—";
    public string Manufacturer => Printer.Manufacturer ?? "—";
    public string Model => Printer.Model ?? "—";
    public string Serial => Printer.Serial ?? "—";

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
