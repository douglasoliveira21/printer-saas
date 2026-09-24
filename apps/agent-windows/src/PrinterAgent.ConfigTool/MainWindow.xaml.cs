using System.Diagnostics;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Threading;
using PrinterAgent.Core.Discovery;
using WinForms = System.Windows.Forms;

namespace PrinterAgent.ConfigTool;

public partial class MainWindow : Window
{
    private readonly WindowsServiceInstaller _installer = new();
    private readonly DispatcherTimer _refreshTimer;
    private readonly AgentContext _context;
    private readonly InstallSeed? _seed;
    private readonly WinForms.NotifyIcon _trayIcon;
    private bool _tabsInitialized;
    private bool _exiting;

    public MainWindow()
    {
        InitializeComponent();
        _context = new AgentContext(_installer);
        _refreshTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };
        _refreshTimer.Tick += (_, _) => RefreshStatus();
        _refreshTimer.Start();

        _trayIcon = CreateTrayIcon();

        // Só confia no appsettings.json salvo em Program Files quando o
        // serviço está DE FATO instalado — uma instalação anterior que
        // falhou no meio (ex.: arquivo travado por outro processo) pode
        // deixar esse arquivo lá com o ApiUrl de desenvolvimento
        // (localhost) do template, mesmo sem o Agent nunca ter chegado a
        // ser registrado. Sem essa checagem, a tela mostrava "Servidor:
        // http://localhost:3001" mesmo dizendo "não instalado".
        ApiUrlText.Text = _installer.GetState() != AgentServiceState.NotInstalled
            ? _installer.GetConfiguredApiUrl() ?? WindowsServiceInstaller.DefaultApiUrl
            : WindowsServiceInstaller.DefaultApiUrl;

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

    /// <summary>
    /// Fecha (X) só esconde a janela — o Agent continua rodando perto do
    /// relógio. Duplo clique ou "Abrir" no menu reabre; "Sair" é a única
    /// forma de encerrar o programa de verdade, e exige confirmação porque
    /// para o monitoramento junto.
    /// </summary>
    private WinForms.NotifyIcon CreateTrayIcon()
    {
        var icon = System.Drawing.Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule!.FileName!);

        var openItem = new WinForms.ToolStripMenuItem("Abrir");
        openItem.Click += (_, _) => ShowFromTray();

        var exitItem = new WinForms.ToolStripMenuItem("Sair");
        exitItem.Click += (_, _) => ExitApplication();

        var menu = new WinForms.ContextMenuStrip();
        menu.Items.Add(openItem);
        menu.Items.Add(new WinForms.ToolStripSeparator());
        menu.Items.Add(exitItem);

        var trayIcon = new WinForms.NotifyIcon
        {
            Icon = icon,
            Text = "Vgon Printer Agent",
            ContextMenuStrip = menu,
            Visible = true,
        };
        trayIcon.DoubleClick += (_, _) => ShowFromTray();
        return trayIcon;
    }

    private void ShowFromTray()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    private void Window_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (_exiting)
        {
            return;
        }
        e.Cancel = true;
        Hide();
        _trayIcon.ShowBalloonTip(3000, "Vgon Printer Agent", "O Agent continua rodando perto do relógio. Clique com o botão direito no ícone para sair de verdade.", WinForms.ToolTipIcon.Info);
    }

    /// <summary>
    /// The only real exit path. Confirms first because it also stops the
    /// Windows Service (spec: this tray icon existing = monitoring is
    /// active) — closing the window alone (Window_Closing above) never
    /// reaches here, so an accidental Alt+F4/X can't silently stop
    /// monitoring.
    /// </summary>
    private void ExitApplication()
    {
        var result = MessageBox.Show(this,
            "Deseja realmente sair? Isso vai parar o monitoramento das impressoras nesta máquina.",
            "Vgon Printer Agent", MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (result != MessageBoxResult.Yes)
        {
            return;
        }

        try
        {
            if (_installer.GetState() == AgentServiceState.Running)
            {
                _installer.Stop();
            }
        }
        catch
        {
            // Best-effort — não deixa uma falha ao parar o serviço impedir o programa de fechar.
        }

        _exiting = true;
        _trayIcon.Visible = false;
        _trayIcon.Dispose();
        Close();
        WinForms.Application.Exit();
        Application.Current.Shutdown();
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
        // Enquanto não instalado, a tela de configuração inicial é a ÚNICA
        // coisa visível — nem o shell (impressoras/ferramentas/etc.) nem os
        // botões de Iniciar/Parar/Desinstalar aparecem, só depois de
        // validar o token e instalar. Uma vez instalado, o token some (fica
        // só em Configurações) e o shell normal assume a tela toda.
        SetupPanel.Visibility = installed ? Visibility.Collapsed : Visibility.Visible;
        InstalledActionsPanel.Visibility = installed ? Visibility.Visible : Visibility.Collapsed;
        ShellGrid.Visibility = installed ? Visibility.Visible : Visibility.Collapsed;
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

    private async void InstallButton_Click(object sender, RoutedEventArgs e)
    {
        var token = EnrollmentTokenTextBox.Text.Trim();
        var alreadyInstalled = _installer.GetState() != AgentServiceState.NotInstalled;
        var apiUrl = _seed?.ApiUrl ?? WindowsServiceInstaller.DefaultApiUrl;

        if (!alreadyInstalled && string.IsNullOrWhiteSpace(token))
        {
            MessageBox.Show(this, "Informe o token de instalação gerado no SaaS (Configurações → Agents → Adicionar Agent).",
                "Vgon Printer Agent", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        // Primeira instalação (ainda sem serviço): valida o token e confirma
        // o cliente ANTES de instalar qualquer coisa — reinstalação/
        // atualização de um Agent já enrolado não tem token novo pra
        // validar, então pula direto pra instalação.
        if (!alreadyInstalled)
        {
            string? customerName = _seed?.CustomerName;
            if (string.IsNullOrWhiteSpace(customerName))
            {
                SetButtonsEnabled(false);
                var lookup = await EnrollmentLookupClient.LookupAsync(apiUrl, token);
                SetButtonsEnabled(true);

                if (lookup is null)
                {
                    MessageBox.Show(this, "Token de instalação inválido ou expirado. Gere um novo em Configurações → Agents → Adicionar Agent, no SaaS.",
                        "Vgon Printer Agent", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }
                customerName = lookup.CustomerName;
            }

            var confirmMessage = string.IsNullOrWhiteSpace(customerName)
                ? "Este token de instalação não está vinculado a um cliente específico. Confirma que quer continuar?"
                : $"Este token de instalação é do cliente \"{customerName}\". Confirma que é este mesmo?";
            var confirm = MessageBox.Show(this, confirmMessage, "Vgon Printer Agent", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (confirm != MessageBoxResult.Yes)
            {
                return;
            }
        }

        try
        {
            SetButtonsEnabled(false);
            _installer.InstallOrUpdate(apiUrl, token, NetworksTextBox.Text.Trim());
            if (_seed is not null)
            {
                _installer.MarkInstallSeedUsed();
            }
            MessageBox.Show(this, "Agent instalado e iniciado com sucesso.", "Vgon Printer Agent", MessageBoxButton.OK, MessageBoxImage.Information);

            var addShortcut = MessageBox.Show(this, "Deseja adicionar um atalho na Área de Trabalho?",
                "Vgon Printer Agent", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (addShortcut == MessageBoxResult.Yes)
            {
                try
                {
                    WindowsServiceInstaller.CreateDesktopShortcut();
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, $"Não foi possível criar o atalho: {ex.Message}", "Vgon Printer Agent", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Falha ao instalar: {ex.Message}", "Vgon Printer Agent", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            SetButtonsEnabled(true);
            RefreshStatus();
        }
    }

    private void SetButtonsEnabled(bool enabled)
    {
        SetupInstallButton.IsEnabled = enabled;
        InstallButton.IsEnabled = enabled;
    }

    private void StartButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            _installer.Start();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Falha ao iniciar: {ex.Message}", "Vgon Printer Agent", MessageBoxButton.OK, MessageBoxImage.Error);
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
            MessageBox.Show(this, $"Falha ao parar: {ex.Message}", "Vgon Printer Agent", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        RefreshStatus();
    }

    private void UninstallButton_Click(object sender, RoutedEventArgs e)
    {
        var result = MessageBox.Show(this, "Isso vai parar e remover o serviço do Agent desta máquina. Continuar?",
            "Vgon Printer Agent", MessageBoxButton.YesNo, MessageBoxImage.Question);
        if (result != MessageBoxResult.Yes)
        {
            return;
        }

        try
        {
            _installer.Uninstall();
            MessageBox.Show(this, "Agent removido.", "Vgon Printer Agent", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Falha ao desinstalar: {ex.Message}", "Vgon Printer Agent", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        RefreshStatus();
    }
}
