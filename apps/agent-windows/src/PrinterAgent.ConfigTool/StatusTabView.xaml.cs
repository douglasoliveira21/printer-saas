using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using PrinterAgent.Core.Configuration;

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
        // ConfigTool + Service são sempre publicados juntos na mesma versão
        // (ver build-msi.ps1/build-package.ps1) — a versão compilada neste
        // .exe que está rodando é a mesma do Service instalado ao lado dele.
        AgentVersionText.Text = AgentVersion.Current;
    }

    private void RefreshStatusButton_Click(object sender, RoutedEventArgs e) => RefreshStatus();
}
