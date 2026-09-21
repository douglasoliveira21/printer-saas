using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace PrinterAgent.ConfigTool;

public partial class StatusTabView : UserControl
{
    private AgentContext? _context;

    public StatusTabView()
    {
        InitializeComponent();
    }

    public void Initialize(AgentContext context)
    {
        _context = context;
        RefreshStatus();
    }

    public void RefreshStatus()
    {
        if (_context is null) return;
        var state = _context.Installer.GetState();
        (LinkServiceStatusText.Text, LinkServiceDot.Fill) = state switch
        {
            AgentServiceState.Running => ("Em execução", (Brush)FindResource("SuccessBrush")),
            AgentServiceState.Stopped => ("Parado", (Brush)FindResource("WarningBrush")),
            AgentServiceState.NotInstalled => ("Não instalado", (Brush)FindResource("MutedBrush")),
            _ => ("Desconhecido", (Brush)FindResource("MutedBrush")),
        };
    }

    private void RefreshStatusButton_Click(object sender, RoutedEventArgs e) => RefreshStatus();
}
