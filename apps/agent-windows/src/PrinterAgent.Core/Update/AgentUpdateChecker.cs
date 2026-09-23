using System.Diagnostics;
using System.Security.Cryptography;
using Microsoft.Extensions.Logging;
using PrinterAgent.Core.Api;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Models;

namespace PrinterAgent.Core.Update;

/// <summary>
/// Polls GET /agent-api/v1/latest-release, and if a newer, verified release
/// is available, downloads it and hands off to PrinterAgentUpdater.exe (see
/// that project's own doc comment for why a separate process has to do the
/// actual stop/replace/restart — this class only ever gets as far as
/// "verified, launching the updater").
///
/// Two independent checks gate every install, both must pass:
///  1. SHA256 of the download matches what the server said (integrity —
///     catches a truncated/corrupted download, not a hostile one).
///  2. AuthenticodeVerifier confirms the file is signed by the Agent's own
///     compiled-in certificate thumbprint, chain-trusted by Windows itself
///     (authenticity — the actual security boundary; see that class).
/// The server's own claimed SHA256/thumbprint are never trusted blindly:
/// (1) is checked before (2) even runs, and (2) never uses anything the
/// server supplied for its own pinned-thumbprint comparison.
/// </summary>
public class AgentUpdateChecker
{
    private readonly PrinterSaasApiClient _apiClient;
    private readonly ILogger<AgentUpdateChecker> _logger;
    private readonly HttpClient _downloadClient;

    public AgentUpdateChecker(PrinterSaasApiClient apiClient, ILogger<AgentUpdateChecker> logger)
    {
        _apiClient = apiClient;
        _logger = logger;
        // Deliberately a plain, unauthenticated HttpClient — downloadUrl can
        // point anywhere (GitHub Releases, S3, ...), and the Agent's API key
        // has no business being sent to a third-party host.
        _downloadClient = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
    }

    public async Task CheckAndApplyAsync(CancellationToken ct)
    {
        var release = await _apiClient.GetLatestReleaseAsync(ct);
        if (release is null)
        {
            _logger.LogDebug("No active Agent release published, or update check failed — nothing to do.");
            return;
        }

        if (!IsNewer(release.Version, AgentVersion.Current))
        {
            _logger.LogDebug("Current version {Current} is already up to date (latest published: {Latest}).", AgentVersion.Current, release.Version);
            return;
        }

        _logger.LogInformation("New Agent version available: {Latest} (current: {Current}). Downloading...", release.Version, AgentVersion.Current);

        var downloadPath = Path.Combine(Path.GetTempPath(), $"PrinterAgentSetup-{release.Version}.msi");
        try
        {
            await DownloadAsync(release.DownloadUrl, downloadPath, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to download update {Version} — will retry next check.", release.Version);
            return;
        }

        if (!VerifyHash(downloadPath, release.Sha256))
        {
            _logger.LogError("Downloaded update {Version} failed SHA256 verification — refusing to install. File deleted.", release.Version);
            TryDelete(downloadPath);
            return;
        }

        if (!AuthenticodeVerifier.Verify(downloadPath, out var reason))
        {
            _logger.LogError(
                "Downloaded update {Version} failed signature verification ({Reason}) — refusing to install. File deleted.",
                release.Version, reason);
            TryDelete(downloadPath);
            return;
        }

        _logger.LogInformation("Update {Version} verified (hash + signature). Launching updater...", release.Version);
        LaunchUpdater(downloadPath);
    }

    /// <summary>Simple SemVer (major.minor.patch) comparison — good enough for our own release numbering, no pre-release/build-metadata support needed.</summary>
    internal static bool IsNewer(string candidate, string current)
    {
        if (!TryParseSemVer(candidate, out var c) || !TryParseSemVer(current, out var cur))
        {
            return false;
        }
        return c.CompareTo(cur) > 0;
    }

    private static bool TryParseSemVer(string value, out (int Major, int Minor, int Patch) result)
    {
        result = default;
        var parts = value.Split('.');
        if (parts.Length != 3) return false;
        if (!int.TryParse(parts[0], out var major)) return false;
        if (!int.TryParse(parts[1], out var minor)) return false;
        if (!int.TryParse(parts[2], out var patch)) return false;
        result = (major, minor, patch);
        return true;
    }

    private async Task DownloadAsync(string url, string destination, CancellationToken ct)
    {
        using var response = await _downloadClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();
        await using var httpStream = await response.Content.ReadAsStreamAsync(ct);
        await using var fileStream = File.Create(destination);
        await httpStream.CopyToAsync(fileStream, ct);
    }

    private bool VerifyHash(string filePath, string expectedSha256)
    {
        using var stream = File.OpenRead(filePath);
        var hash = SHA256.HashData(stream);
        var hex = Convert.ToHexString(hash);
        return string.Equals(hex, expectedSha256, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Launches PrinterAgentUpdater.exe detached (UseShellExecute so it
    /// survives this process's own exit/service-stop) and returns
    /// immediately — this process does not wait for it, since the whole
    /// point is that the updater keeps running after the service that
    /// spawned it has been told to stop.
    /// </summary>
    private void LaunchUpdater(string msiPath)
    {
        var installPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PrinterSaaS", "Agent");
        // Own subfolder, not AGENTFOLDER's root — see UPDATERFOLDER's
        // comment in Package.wxs for why (name collision with the
        // ConfigTool's self-contained runtime files if it weren't).
        var updaterExe = Path.Combine(installPath, "Updater", "PrinterAgentUpdater.exe");
        if (!File.Exists(updaterExe))
        {
            _logger.LogError("PrinterAgentUpdater.exe not found at '{Path}' — cannot apply update. Was the Agent installed via the MSI?", updaterExe);
            return;
        }

        var serviceFilesPath = Path.Combine(installPath, "ServiceFiles");
        var backupPath = Path.Combine(Path.GetTempPath(), "PrinterSaaS-Agent-Update-Backup");

        var psi = new ProcessStartInfo(updaterExe)
        {
            UseShellExecute = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        psi.ArgumentList.Add("--msi");
        psi.ArgumentList.Add(msiPath);
        psi.ArgumentList.Add("--service-name");
        psi.ArgumentList.Add("PrinterSaaSAgent");
        psi.ArgumentList.Add("--service-files");
        psi.ArgumentList.Add(serviceFilesPath);
        psi.ArgumentList.Add("--backup");
        psi.ArgumentList.Add(backupPath);

        Process.Start(psi);
        _logger.LogInformation("Updater launched — this process (and the Windows Service) will be stopped shortly as part of the update.");
    }

    private void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not delete temp file '{Path}' (non-fatal).", path);
        }
    }
}
