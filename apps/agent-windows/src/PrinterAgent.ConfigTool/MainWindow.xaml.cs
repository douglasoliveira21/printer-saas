using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;

namespace PrinterAgent.ConfigTool;

public partial class MainWindow : Window
{
    private readonly WindowsServiceInstaller _installer = new();
    private readonly DispatcherTimer _refreshTimer;

    public MainWindow()
    {
        InitializeComponent();
        _refreshTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };
        _refreshTimer.Tick += (_, _) => RefreshStatus();
        _refreshTimer.Start();

        ApiUrlText.Text = _installer.GetConfiguredApiUrl() ?? WindowsServiceInstaller.DefaultApiUrl;

        var existingNetworks = _installer.GetConfiguredNetworks();
        if (!string.IsNullOrWhiteSpace(existingNetworks))
        {
            NetworksTextBox.Text = existingNetworks;
        }

        RefreshStatus();
    }

    private void RefreshStatus()
    {
        var state = _installer.GetState();
        (StatusText.Text, StatusDot.Fill, InstallButton.Content) = state switch
        {
            AgentServiceState.Running => ("Agent instalado e rodando", (Brush)new SolidColorBrush(Color.FromRgb(0x16, 0xA3, 0x4A)), (object)"Reinstalar / Atualizar"),
            AgentServiceState.Stopped => ("Agent instalado, mas parado", (Brush)new SolidColorBrush(Color.FromRgb(0xD9, 0x7B, 0x0E)), (object)"Reinstalar / Atualizar"),
            AgentServiceState.NotInstalled => ("Agent não instalado nesta máquina", Brushes.Gray, (object)"Instalar e Iniciar"),
            _ => ("Status desconhecido", Brushes.Gray, (object)"Reinstalar / Atualizar"),
        };

        StartButton.IsEnabled = state == AgentServiceState.Stopped;
        StopButton.IsEnabled = state == AgentServiceState.Running;
        UninstallButton.IsEnabled = state != AgentServiceState.NotInstalled;

        var logTail = _installer.ReadRecentLogTail();
        if (logTail is not null)
        {
            LogTextBox.Text = logTail;
            LogTextBox.ScrollToEnd();
        }
    }

    private void InstallButton_Click(object sender, RoutedEventArgs e)
    {
        var token = EnrollmentTokenTextBox.Text.Trim();

        var alreadyInstalled = _installer.GetState() != AgentServiceState.NotInstalled;
        if (!alreadyInstalled && string.IsNullOrWhiteSpace(token))
        {
            MessageBox.Show(this, "Informe o token de instalação gerado no SaaS (Configurações → Agents → Adicionar Agent).",
                "Printer SaaS Agent", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        try
        {
            InstallButton.IsEnabled = false;
            _installer.InstallOrUpdate(WindowsServiceInstaller.DefaultApiUrl, token, NetworksTextBox.Text.Trim());
            MessageBox.Show(this, "Agent instalado e iniciado com sucesso.", "Printer SaaS Agent", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Falha ao instalar: {ex.Message}", "Printer SaaS Agent", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            InstallButton.IsEnabled = true;
            RefreshStatus();
        }
    }

    private void StartButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            _installer.Start();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Falha ao iniciar: {ex.Message}", "Printer SaaS Agent", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        RefreshStatus();
    }

    private void StopButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            _installer.Stop();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Falha ao parar: {ex.Message}", "Printer SaaS Agent", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        RefreshStatus();
    }

    private void UninstallButton_Click(object sender, RoutedEventArgs e)
    {
        var result = MessageBox.Show(this, "Isso vai parar e remover o serviço do Agent desta máquina. Continuar?",
            "Printer SaaS Agent", MessageBoxButton.YesNo, MessageBoxImage.Question);
        if (result != MessageBoxResult.Yes)
        {
            return;
        }

        try
        {
            _installer.Uninstall();
            MessageBox.Show(this, "Agent removido.", "Printer SaaS Agent", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Falha ao desinstalar: {ex.Message}", "Printer SaaS Agent", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        RefreshStatus();
    }
}
