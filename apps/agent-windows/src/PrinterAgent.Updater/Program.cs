using System.Diagnostics;
using System.ServiceProcess;

// PrinterAgent.Updater — a small, deliberately standalone helper (no
// PrinterAgent.Core reference) that does the one thing the Windows Service
// itself structurally cannot do to its own running files: stop, replace,
// restart, and roll back if the new version doesn't come back up.
//
// Why a separate process at all: msiexec can't overwrite
// PrinterAgent.Service.exe while that exe is running (the file is locked).
// The service can download and verify an update (see
// PrinterAgent.Core.Update.AuthenticodeVerifier / AgentUpdateChecker) but it
// can't safely stop *itself* and then keep running code to finish the job —
// once stopped, its process is gone. So the service's last act before an
// update is to launch this as a detached process and exit; this process
// outlives that shutdown and does the actual stop -> msiexec -> restart ->
// verify -> rollback sequence.
//
// Usage:
//   PrinterAgentUpdater.exe --msi <path> --service-name <name>
//     --service-files <InstallPath>\ServiceFiles --backup <tempDir>
//     [--wait-seconds 3] [--start-timeout-seconds 30]

var options = UpdaterOptions.Parse(args);
var logPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
    "PrinterSaaS", "Agent", "Logs", $"updater-{DateTime.UtcNow:yyyyMMdd-HHmmss}.log");
Directory.CreateDirectory(Path.GetDirectoryName(logPath)!);
using var log = new StreamWriter(logPath, append: false) { AutoFlush = true };

void Log(string message)
{
    var line = $"{DateTime.UtcNow:O} {message}";
    Console.WriteLine(line);
    log.WriteLine(line);
}

try
{
    Log($"Starting update. MSI={options.MsiPath} Service={options.ServiceName} ServiceFiles={options.ServiceFilesPath} Backup={options.BackupPath}");

    // Let the caller (the service process that spawned us) finish exiting —
    // stopping a service while its own process is mid-shutdown can race.
    Thread.Sleep(TimeSpan.FromSeconds(options.WaitSeconds));

    StopService(options.ServiceName, Log);

    Log("Backing up current ServiceFiles before install...");
    BackUp(options.ServiceFilesPath, options.BackupPath, Log);

    Log("Running msiexec...");
    var msiExitCode = RunMsiExec(options.MsiPath, Log);
    // 3010 = ERROR_SUCCESS_REBOOT_REQUIRED — still a successful install for
    // our purposes (we're about to start the service ourselves; a pending
    // reboot flag doesn't block that).
    var msiOk = msiExitCode == 0 || msiExitCode == 3010;
    Log($"msiexec exited with code {msiExitCode} ({(msiOk ? "treated as success" : "treated as failure")}).");

    if (msiOk && TryStartAndVerify(options.ServiceName, options.StartTimeoutSeconds, Log))
    {
        Log("Update successful — service is running the new version. Cleaning up backup.");
        TryDeleteDirectory(options.BackupPath, Log);
        return 0;
    }

    Log("Update did not come up cleanly — rolling back to the previous version.");
    Rollback(options.ServiceName, options.ServiceFilesPath, options.BackupPath, options.StartTimeoutSeconds, Log);
    return 1;
}
catch (Exception ex)
{
    Log($"FATAL: unhandled exception during update: {ex}");
    try
    {
        Rollback(options.ServiceName, options.ServiceFilesPath, options.BackupPath, options.StartTimeoutSeconds, Log);
    }
    catch (Exception rollbackEx)
    {
        Log($"FATAL: rollback itself failed: {rollbackEx}");
    }
    return 2;
}

static void StopService(string serviceName, Action<string> log)
{
    try
    {
        using var controller = new ServiceController(serviceName);
        if (controller.Status != ServiceControllerStatus.Stopped)
        {
            controller.Stop();
            controller.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(30));
        }
        log($"Service '{serviceName}' stopped.");
    }
    catch (InvalidOperationException)
    {
        // Service doesn't exist yet (e.g. first-ever install never
        // finished) — nothing to stop, msiexec will just lay down files.
        log($"Service '{serviceName}' not found — nothing to stop.");
    }
}

static bool TryStartAndVerify(string serviceName, int timeoutSeconds, Action<string> log)
{
    try
    {
        using var controller = new ServiceController(serviceName);
        controller.Start();
        controller.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(timeoutSeconds));
        return controller.Status == ServiceControllerStatus.Running;
    }
    catch (Exception ex)
    {
        log($"Service did not reach Running within {timeoutSeconds}s: {ex.Message}");
        return false;
    }
}

static void Rollback(string serviceName, string serviceFilesPath, string backupPath, int timeoutSeconds, Action<string> log)
{
    if (!Directory.Exists(backupPath))
    {
        log("No backup available to roll back to — leaving whatever state msiexec left behind. Manual intervention needed.");
        return;
    }

    StopService(serviceName, log);
    log("Restoring ServiceFiles from backup...");
    if (Directory.Exists(serviceFilesPath))
    {
        Directory.Delete(serviceFilesPath, recursive: true);
    }
    CopyDirectory(backupPath, serviceFilesPath);

    if (TryStartAndVerify(serviceName, timeoutSeconds, log))
    {
        log("Rollback successful — previous version is running again.");
    }
    else
    {
        log("Rollback restored the files but the service still did not start. Manual intervention needed.");
    }
}

static void BackUp(string source, string destination, Action<string> log)
{
    if (Directory.Exists(destination))
    {
        Directory.Delete(destination, recursive: true);
    }
    if (!Directory.Exists(source))
    {
        log($"WARNING: source '{source}' does not exist — nothing to back up (first-ever install?).");
        return;
    }
    CopyDirectory(source, destination);
}

static void CopyDirectory(string source, string destination)
{
    Directory.CreateDirectory(destination);
    foreach (var dir in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
    {
        Directory.CreateDirectory(dir.Replace(source, destination));
    }
    foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
    {
        File.Copy(file, file.Replace(source, destination), overwrite: true);
    }
}

static void TryDeleteDirectory(string path, Action<string> log)
{
    try
    {
        if (Directory.Exists(path))
        {
            Directory.Delete(path, recursive: true);
        }
    }
    catch (Exception ex)
    {
        // Best-effort — a leftover backup folder just wastes a little disk, it doesn't affect correctness.
        log($"Could not delete backup folder '{path}': {ex.Message}");
    }
}

static int RunMsiExec(string msiPath, Action<string> log)
{
    var msiLogPath = Path.ChangeExtension(msiPath, ".install.log");
    var psi = new ProcessStartInfo("msiexec.exe")
    {
        UseShellExecute = false,
        CreateNoWindow = true,
    };
    psi.ArgumentList.Add("/i");
    psi.ArgumentList.Add(msiPath);
    psi.ArgumentList.Add("/quiet");
    psi.ArgumentList.Add("/norestart");
    psi.ArgumentList.Add("/l*v");
    psi.ArgumentList.Add(msiLogPath);

    using var process = Process.Start(psi) ?? throw new InvalidOperationException("Failed to start msiexec.exe");
    process.WaitForExit();
    log($"msiexec log: {msiLogPath}");
    return process.ExitCode;
}

internal sealed class UpdaterOptions
{
    public required string MsiPath { get; init; }
    public required string ServiceName { get; init; }
    public required string ServiceFilesPath { get; init; }
    public required string BackupPath { get; init; }
    public int WaitSeconds { get; init; } = 3;
    public int StartTimeoutSeconds { get; init; } = 30;

    public static UpdaterOptions Parse(string[] args)
    {
        string? msiPath = null, serviceName = null, serviceFilesPath = null, backupPath = null;
        var waitSeconds = 3;
        var startTimeoutSeconds = 30;

        for (var i = 0; i < args.Length - 1; i++)
        {
            switch (args[i])
            {
                case "--msi": msiPath = args[++i]; break;
                case "--service-name": serviceName = args[++i]; break;
                case "--service-files": serviceFilesPath = args[++i]; break;
                case "--backup": backupPath = args[++i]; break;
                case "--wait-seconds": waitSeconds = int.Parse(args[++i]); break;
                case "--start-timeout-seconds": startTimeoutSeconds = int.Parse(args[++i]); break;
            }
        }

        if (msiPath is null || serviceName is null || serviceFilesPath is null || backupPath is null)
        {
            throw new ArgumentException(
                "Usage: PrinterAgentUpdater.exe --msi <path> --service-name <name> --service-files <path> --backup <path> [--wait-seconds N] [--start-timeout-seconds N]");
        }

        return new UpdaterOptions
        {
            MsiPath = msiPath,
            ServiceName = serviceName,
            ServiceFilesPath = serviceFilesPath,
            BackupPath = backupPath,
            WaitSeconds = waitSeconds,
            StartTimeoutSeconds = startTimeoutSeconds,
        };
    }
}
