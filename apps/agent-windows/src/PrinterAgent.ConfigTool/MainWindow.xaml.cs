using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Threading;
using PrinterAgent.Core.Discovery;

namespace PrinterAgent.ConfigTool;

public partial class MainWindow : Window
{
    private readonly WindowsServiceInstaller _installer = new();
    private readonly DispatcherTimer _refreshTimer;
    private readonly AgentContext _context;
    private readonly InstallSeed? _seed;
    private bool _tabsInitialized;

    public MainWindow()
    {
        InitializeComponent();
        _context = new AgentContext(_installer);
        _refreshTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };
        _refreshTimer.Tick += (_, _) => RefreshStatus();
        _refreshTimer.Start();

        ApiUrlText.Text = _installer.GetConfiguredApiUrl() ?? WindowsServiceInstaller.DefaultApiUrl;

        // Seed file dropped next to the exe (from the site's "Adicionar Agent"
        // download) means the token doesn't need to be typed in by hand.
        _seed = _installer.TryReadInstallSeed();
        if (_seed is not null)
        {
            EnrollmentTokenTextBox.Text = _seed.EnrollmentToken ?? "";
            EnrollmentTokenTextBox.IsReadOnly = true;
            EnrollmentTokenTextBox.Visibility = Visibility.Collapsed;
            TokenSectionLabel.Visibility = Visibility.Collapsed;
            TokenSectionCaption.Visibility = Visibility.Collapsed;
            SeedCustomerText.Visibility = Visibility.Visible;
            SeedCustomerText.Text = string.IsNullOrWhiteSpace(_seed.CustomerName)
                ? "Token de instalação carregado automaticamente."
                : $"Cliente: {_seed.CustomerName} — token de instalação carregado automaticamente.";
            if (!string.IsNullOrWhiteSpace(_seed.ApiUrl))
            {
                ApiUrlText.Text = _seed.ApiUrl;
            }
        }

        var existingNetworks = _installer.GetConfiguredNetworks();
        if (!string.IsNullOrWhiteSpace(existingNetworks))
        {
            NetworksTextBox.Text = existingNetworks;
        }
        else
        {
            // Not configured yet — suggest this machine's own subnet(s)
            // instead of leaving the field blank or guessing "192.168.1.0/24".
            var detected = LocalNetwork.GetLocalIPv4Cidrs();
            if (detected.Count > 0)
            {
                NetworksTextBox.Text = string.Join(", ", detected);
            }
        }

        RefreshStatus();
    }

    private void RefreshStatus()
    {
        var state = _installer.GetState();
        (StatusText.Text, StatusDot.Fill, InstallButton.Content) = state switch
        {
            AgentServiceState.Running => ("Agent instalado e rodando", (Brush)FindResource("SuccessBrush"), (object)"Reinstalar / Atualizar"),
            AgentServiceState.Stopped => ("Agent instalado, mas parado", (Brush)FindResource("WarningBrush"), (object)"Reinstalar / Atualizar"),
            AgentServiceState.NotInstalled => ("Agent não instalado nesta máquina", (Brush)FindResource("MutedBrush"), (object)"Instalar e Iniciar"),
            _ => ("Status desconhecido", (Brush)FindResource("MutedBrush"), (object)"Reinstalar / Atualizar"),
        };

        StartButton.IsEnabled = state == AgentServiceState.Stopped;
        StopButton.IsEnabled = state == AgentServiceState.Running;
        UninstallButton.IsEnabled = state != AgentServiceState.NotInstalled;

        var installed = state != AgentServiceState.NotInstalled;
        // Once installed, the setup fields (token/networks) get out of the
        // way — same information stays reachable via Configurações.
        SetupPanel.Visibility = installed ? Visibility.Collapsed : Visibility.Visible;
        ShellGrid.IsEnabled = installed;

        if (installed && !_tabsInitialized)
        {
            _tabsInitialized = true;
            PrintersTab.Initialize(_context);
            ToolsTab.Initialize(_context);
            StatusTab.Initialize(_context);
            SettingsTab.Initialize(_context);
            _ = PrintersTab.RefreshAsync();
        }
        else if (installed)
        {
            StatusTab.RefreshStatus();
        }
    }

    private void NavButton_Click(object sender, RoutedEventArgs e)
    {
        foreach (var toggle in new[] { NavPrinters, NavTools, NavStatus, NavSettings })
        {
            toggle.IsChecked = ReferenceEquals(toggle, sender);
        }

        PrintersTab.Visibility = ReferenceEquals(sender, NavPrinters) ? Visibility.Visible : Visibility.Collapsed;
        ToolsTab.Visibility = ReferenceEquals(sender, NavTools) ? Visibility.Visible : Visibility.Collapsed;
        StatusTab.Visibility = ReferenceEquals(sender, NavStatus) ? Visibility.Visible : Visibility.Collapsed;
        SettingsTab.Visibility = ReferenceEquals(sender, NavSettings) ? Visibility.Visible : Visibility.Collapsed;

        if (ReferenceEquals(sender, NavPrinters) && _tabsInitialized)
        {
            _ = PrintersTab.RefreshAsync();
        }
        else if (ReferenceEquals(sender, NavStatus) && _tabsInitialized)
        {
            StatusTab.RefreshStatus();
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
            var apiUrl = _seed?.ApiUrl ?? WindowsServiceInstaller.DefaultApiUrl;
            _installer.InstallOrUpdate(apiUrl, token, NetworksTextBox.Text.Trim());
            if (_seed is not null)
            {
                _installer.MarkInstallSeedUsed();
            }
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
