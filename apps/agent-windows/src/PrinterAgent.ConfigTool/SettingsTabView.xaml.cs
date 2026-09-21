using System.Net;
using System.Net.Http;
using System.Windows;
using System.Windows.Controls;
using PrinterAgent.Core.Configuration;

namespace PrinterAgent.ConfigTool;

public partial class SettingsTabView : UserControl
{
    private AgentContext? _context;

    public SettingsTabView()
    {
        InitializeComponent();
    }

    public void Initialize(AgentContext context)
    {
        _context = context;
        LoadCurrentValues();
    }

    private void LoadCurrentValues()
    {
        if (_context is null) return;

        var discovery = _context.Installer.GetConfiguredDiscoverySettings();
        DiscoveryIntervalTextBox.Text = discovery.DiscoveryIntervalMinutes.ToString();
        HeartbeatIntervalTextBox.Text = discovery.HeartbeatIntervalSeconds.ToString();
        NeverDiscoverCheckBox.IsChecked = !discovery.DiscoveryEnabled;
        DiscoveryIntervalPanel.IsEnabled = discovery.DiscoveryEnabled;

        var proxy = _context.ProxyStore.Load();
        if (proxy is not null)
        {
            ProxyServerTextBox.Text = proxy.Server;
            ProxyPortTextBox.Text = proxy.Port?.ToString();
            ProxyUsernameTextBox.Text = proxy.Username;
            ProxyPasswordBox.Password = proxy.Password ?? "";
            ProxyDomainTextBox.Text = proxy.Domain;
        }
    }

    private void NeverDiscoverCheckBox_Changed(object sender, RoutedEventArgs e)
    {
        DiscoveryIntervalPanel.IsEnabled = NeverDiscoverCheckBox.IsChecked != true;
    }

    private AgentProxySettings? BuildProxySettingsFromForm()
    {
        var server = ProxyServerTextBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(server))
        {
            return null;
        }
        int.TryParse(ProxyPortTextBox.Text.Trim(), out var port);
        return new AgentProxySettings(
            server,
            port,
            string.IsNullOrWhiteSpace(ProxyUsernameTextBox.Text) ? null : ProxyUsernameTextBox.Text.Trim(),
            string.IsNullOrEmpty(ProxyPasswordBox.Password) ? null : ProxyPasswordBox.Password,
            string.IsNullOrWhiteSpace(ProxyDomainTextBox.Text) ? null : ProxyDomainTextBox.Text.Trim());
    }

    private async void TestProxyButton_Click(object sender, RoutedEventArgs e)
    {
        if (_context is null) return;
        var proxySettings = BuildProxySettingsFromForm();
        TestProxyButton.IsEnabled = false;
        ProxyTestStatus.Text = "Testando...";
        ProxyTestStatus.Foreground = (System.Windows.Media.Brush)FindResource("MutedBrush");

        try
        {
            var handler = new HttpClientHandler();
            if (proxySettings is { IsConfigured: true })
            {
                handler.Proxy = new WebProxy(proxySettings.Server!, proxySettings.Port!.Value)
                {
                    Credentials = string.IsNullOrWhiteSpace(proxySettings.Username)
                        ? null
                        : new NetworkCredential(proxySettings.Username, proxySettings.Password, proxySettings.Domain),
                };
                handler.UseProxy = true;
            }
            using var http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(8) };
            var apiUrl = _context.Installer.GetConfiguredApiUrl() ?? WindowsServiceInstaller.DefaultApiUrl;
            var started = DateTime.UtcNow;
            var response = await http.GetAsync(apiUrl.TrimEnd('/') + "/health");
            var elapsedMs = (DateTime.UtcNow - started).TotalMilliseconds;

            if (response.IsSuccessStatusCode)
            {
                ProxyTestStatus.Text = $"Comunicação OK ({elapsedMs:0} ms)";
                ProxyTestStatus.Foreground = (System.Windows.Media.Brush)FindResource("SuccessBrush");
            }
            else
            {
                ProxyTestStatus.Text = $"Servidor respondeu com erro: {response.StatusCode}";
                ProxyTestStatus.Foreground = (System.Windows.Media.Brush)FindResource("WarningBrush");
            }
        }
        catch (Exception ex)
        {
            ProxyTestStatus.Text = $"Falha na comunicação: {ex.Message}";
            ProxyTestStatus.Foreground = (System.Windows.Media.Brush)FindResource("WarningBrush");
        }
        finally
        {
            TestProxyButton.IsEnabled = true;
        }
    }

    private void SaveButton_Click(object sender, RoutedEventArgs e) => Save(restart: false);

    private void SaveAndRestartButton_Click(object sender, RoutedEventArgs e) => Save(restart: true);

    private void Save(bool restart)
    {
        if (_context is null) return;

        if (!int.TryParse(DiscoveryIntervalTextBox.Text.Trim(), out var discoveryMinutes) || discoveryMinutes < 1)
        {
            SaveStatus.Text = "Informe um intervalo de busca válido (em minutos).";
            return;
        }
        if (!int.TryParse(HeartbeatIntervalTextBox.Text.Trim(), out var heartbeatSeconds) || heartbeatSeconds < 5)
        {
            SaveStatus.Text = "Informe um intervalo de heartbeat válido (em segundos, mínimo 5).";
            return;
        }

        try
        {
            _context.Installer.SetConfiguredDiscoverySettings(new AgentDiscoverySettings(
                discoveryMinutes, heartbeatSeconds, NeverDiscoverCheckBox.IsChecked != true));

            var proxySettings = BuildProxySettingsFromForm();
            if (proxySettings is null)
            {
                _context.ProxyStore.Clear();
            }
            else
            {
                _context.ProxyStore.Save(proxySettings);
            }
            _context.RefreshApiClient();

            if (restart)
            {
                SaveStatus.Text = "Salvo. Reiniciando serviço...";
                _context.Installer.Stop();
                _context.Installer.Start();
                SaveStatus.Text = "Salvo e serviço reiniciado.";
            }
            else
            {
                SaveStatus.Text = "Salvo. Reinicie o serviço do Agent (botão \"Parar\"/\"Iniciar\" no topo, ou \"Salvar e reiniciar\") para aplicar.";
            }
        }
        catch (Exception ex)
        {
            SaveStatus.Text = $"Falha ao salvar: {ex.Message}";
        }
    }
}
