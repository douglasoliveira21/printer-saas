using System.Diagnostics;
using System.IO;
using System.ServiceProcess;
using System.Text.Json;

namespace PrinterAgent.ConfigTool;

public enum AgentServiceState
{
    NotInstalled,
    Running,
    Stopped,
    Unknown,
}

/// <summary>
/// GUI-driven equivalent of installer/install-agent.ps1 — copies the
/// published Windows Service files to Program Files, writes
/// appsettings.json, and registers/starts the service via sc.exe. Requires
/// the process to be elevated (see app.manifest).
/// </summary>
public class WindowsServiceInstaller
{
    public const string ServiceName = "PrinterSaaSAgent";

    /// <summary>
    /// Fixed production API endpoint — not user-editable in the UI on
    /// purpose, so whoever installs the Agent at a client site can't point
    /// it at the wrong server by typo. Change this and rebuild
    /// (installer/build-package.ps1) if the platform's API domain changes.
    /// </summary>
    public const string DefaultApiUrl = "https://api.print.vgon.com.br";

    public static readonly string InstallPath =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PrinterSaaS", "Agent");

    public static readonly string LogsPath =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "PrinterSaaS", "Agent", "Logs");

    /// <summary>Where this app expects to find the published PrinterAgent.Service files to copy from — see installer/build-package.ps1.</summary>
    public static string ServiceSourcePath =>
        Path.Combine(AppContext.BaseDirectory, "ServiceFiles");

    public AgentServiceState GetState()
    {
        try
        {
            using var controller = new ServiceController(ServiceName);
            return controller.Status switch
            {
                ServiceControllerStatus.Running => AgentServiceState.Running,
                ServiceControllerStatus.Stopped => AgentServiceState.Stopped,
                _ => AgentServiceState.Unknown,
            };
        }
        catch (InvalidOperationException)
        {
            return AgentServiceState.NotInstalled;
        }
    }

    public string? GetConfiguredApiUrl()
    {
        var path = Path.Combine(InstallPath, "appsettings.json");
        if (!File.Exists(path))
        {
            return null;
        }
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            return doc.RootElement.GetProperty("Agent").GetProperty("ApiUrl").GetString();
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Comma-separated networks as currently configured, e.g. "192.168.1.0/24, 192.168.2.10-192.168.2.50" — for pre-filling the UI.</summary>
    public string? GetConfiguredNetworks()
    {
        var path = Path.Combine(InstallPath, "appsettings.json");
        if (!File.Exists(path))
        {
            return null;
        }
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            var networks = doc.RootElement.GetProperty("Agent").GetProperty("Networks")
                .EnumerateArray()
                .Select(e => e.GetString())
                .Where(s => !string.IsNullOrWhiteSpace(s));
            return string.Join(", ", networks);
        }
        catch
        {
            return null;
        }
    }

    public string GetConfiguredSnmpCommunity()
    {
        var path = Path.Combine(InstallPath, "appsettings.json");
        if (!File.Exists(path))
        {
            return "public";
        }
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            return doc.RootElement.GetProperty("Agent").TryGetProperty("SnmpCommunity", out var v) ? v.GetString() ?? "public" : "public";
        }
        catch
        {
            return "public";
        }
    }

    public AgentDiscoverySettings GetConfiguredDiscoverySettings()
    {
        var path = Path.Combine(InstallPath, "appsettings.json");
        if (!File.Exists(path))
        {
            return new AgentDiscoverySettings(60, 30, true);
        }
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            var agentSection = doc.RootElement.GetProperty("Agent");
            var discoverySeconds = agentSection.TryGetProperty("DiscoveryIntervalSeconds", out var d) ? d.GetInt32() : 3600;
            var heartbeatSeconds = agentSection.TryGetProperty("HeartbeatIntervalSeconds", out var h) ? h.GetInt32() : 30;
            var discoveryEnabled = !agentSection.TryGetProperty("DiscoveryEnabled", out var e) || e.GetBoolean();
            return new AgentDiscoverySettings(Math.Max(1, discoverySeconds / 60), heartbeatSeconds, discoveryEnabled);
        }
        catch
        {
            return new AgentDiscoverySettings(60, 30, true);
        }
    }

    /// <summary>Writes discovery/heartbeat intervals back to appsettings.json. Takes effect on the next service start (see Configurações tab's "Salvar e reiniciar").</summary>
    public void SetConfiguredDiscoverySettings(AgentDiscoverySettings settings)
    {
        var appsettingsPath = Path.Combine(InstallPath, "appsettings.json");
        if (!File.Exists(appsettingsPath))
        {
            throw new InvalidOperationException("Agent ainda não foi instalado nesta máquina.");
        }
        var json = File.ReadAllText(appsettingsPath);
        var root = JsonSerializer.Deserialize<Dictionary<string, object>>(json)!;
        var agentSection = JsonSerializer.Deserialize<Dictionary<string, object>>(JsonSerializer.Serialize(root["Agent"]))!;
        agentSection["DiscoveryIntervalSeconds"] = settings.DiscoveryIntervalMinutes * 60;
        agentSection["HeartbeatIntervalSeconds"] = settings.HeartbeatIntervalSeconds;
        agentSection["DiscoveryEnabled"] = settings.DiscoveryEnabled;
        root["Agent"] = agentSection;
        File.WriteAllText(appsettingsPath, JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }));
    }

    /// <summary>
    /// Looks for a seed file dropped next to this exe (generated by the site's
    /// "Adicionar Agent" screen) so whoever installs doesn't have to type the
    /// token by hand. Absent = fall back to manual entry exactly as before.
    /// </summary>
    public InstallSeed? TryReadInstallSeed()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "install-config.json");
        if (!File.Exists(path))
        {
            return null;
        }
        try
        {
            return JsonSerializer.Deserialize<InstallSeed>(File.ReadAllText(path), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Renames the seed file after a successful install so it isn't accidentally reused on another machine.</summary>
    public void MarkInstallSeedUsed()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "install-config.json");
        if (!File.Exists(path))
        {
            return;
        }
        var usedPath = path + ".used";
        try
        {
            File.Delete(usedPath);
            File.Move(path, usedPath);
        }
        catch
        {
            // Best-effort — leaving the seed file in place isn't harmful, just a missed convenience.
        }
    }

    /// <param name="networksCsv">
    /// Alvos de discovery separados por vírgula: "192.168.1.0/24", IP único
    /// ou faixa "192.168.1.100-192.168.1.200" (spec §15) — ver NetworkRange.Expand.
    /// </param>
    public void InstallOrUpdate(string apiUrl, string enrollmentToken, string networksCsv)
    {
        if (!Directory.Exists(ServiceSourcePath))
        {
            throw new InvalidOperationException(
                $"Arquivos do serviço não encontrados em '{ServiceSourcePath}'. " +
                "Este instalador precisa ser empacotado junto com a pasta ServiceFiles (ver installer/build-package.ps1).");
        }

        StopServiceIfRunning();
        DeleteServiceIfExists();

        Directory.CreateDirectory(InstallPath);
        CopyDirectory(ServiceSourcePath, InstallPath);

        var appsettingsPath = Path.Combine(InstallPath, "appsettings.json");
        var json = File.ReadAllText(appsettingsPath);
        using var doc = JsonDocument.Parse(json);
        var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(json)!;

        var networks = networksCsv
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        var agentSection = JsonSerializer.Deserialize<Dictionary<string, object>>(
            JsonSerializer.Serialize(settings["Agent"]))!;
        agentSection["ApiUrl"] = apiUrl;
        agentSection["EnrollmentToken"] = enrollmentToken;
        agentSection["Networks"] = networks;
        settings["Agent"] = agentSection;

        File.WriteAllText(appsettingsPath, JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true }));

        var exePath = Path.Combine(InstallPath, "PrinterAgent.Service.exe");
        if (!File.Exists(exePath))
        {
            throw new InvalidOperationException($"PrinterAgent.Service.exe não encontrado em '{InstallPath}'.");
        }

        RunScOrThrow($"create {ServiceName} binPath= \"{exePath}\" start= auto DisplayName= \"Printer SaaS Agent\"");
        RunSc($"description {ServiceName} \"Descobre e monitora impressoras na rede local para o Printer SaaS.\"");
        RunSc($"failure {ServiceName} reset= 86400 actions= restart/60000/restart/60000/restart/60000");

        using var controller = new ServiceController(ServiceName);
        controller.Start();
        controller.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(15));
    }

    public void Start()
    {
        using var controller = new ServiceController(ServiceName);
        if (controller.Status != ServiceControllerStatus.Running)
        {
            controller.Start();
            controller.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(15));
        }
    }

    public void Stop() => StopServiceIfRunning();

    public void Uninstall()
    {
        StopServiceIfRunning();
        DeleteServiceIfExists();
        if (Directory.Exists(InstallPath))
        {
            Directory.Delete(InstallPath, recursive: true);
        }
    }

    public string? ReadRecentLogTail(int maxLines = 40)
    {
        if (!Directory.Exists(LogsPath))
        {
            return null;
        }
        var latest = new DirectoryInfo(LogsPath).GetFiles("agent-*.log").OrderByDescending(f => f.LastWriteTimeUtc).FirstOrDefault();
        if (latest is null)
        {
            return null;
        }
        using var stream = new FileStream(latest.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var reader = new StreamReader(stream);
        var lines = new List<string>();
        while (reader.ReadLine() is { } line)
        {
            lines.Add(line);
            if (lines.Count > maxLines)
            {
                lines.RemoveAt(0);
            }
        }
        return string.Join(Environment.NewLine, lines);
    }

    private void StopServiceIfRunning()
    {
        try
        {
            using var controller = new ServiceController(ServiceName);
            if (controller.Status != ServiceControllerStatus.Stopped)
            {
                controller.Stop();
                controller.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(15));
            }
        }
        catch (InvalidOperationException)
        {
            // service doesn't exist — nothing to stop
        }
    }

    private void DeleteServiceIfExists()
    {
        if (GetState() != AgentServiceState.NotInstalled)
        {
            RunSc($"delete {ServiceName}");
        }
    }

    private static void RunSc(string arguments) => RunProcess("sc.exe", arguments);

    private static void RunScOrThrow(string arguments)
    {
        var (exitCode, output) = RunProcess("sc.exe", arguments);
        if (exitCode != 0)
        {
            throw new InvalidOperationException($"sc.exe falhou ({exitCode}): {output}");
        }
    }

    private static (int ExitCode, string Output) RunProcess(string fileName, string arguments)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo(fileName, arguments)
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            },
        };
        process.Start();
        var output = process.StandardOutput.ReadToEnd() + process.StandardError.ReadToEnd();
        process.WaitForExit();
        return (process.ExitCode, output);
    }

    private static void CopyDirectory(string source, string destination)
    {
        foreach (var dir in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
        {
            Directory.CreateDirectory(dir.Replace(source, destination));
        }
        foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            File.Copy(file, file.Replace(source, destination), overwrite: true);
        }
    }
}

public record AgentDiscoverySettings(int DiscoveryIntervalMinutes, int HeartbeatIntervalSeconds, bool DiscoveryEnabled);

/// <summary>Shape of install-config.json, generated client-side by the site's "Adicionar Agent" dialog — see create-agent-dialog.tsx.</summary>
public record InstallSeed(string? ApiUrl, string? EnrollmentToken, string? AgentName, string? CustomerName);
