using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace PrinterAgent.Core.Configuration;

/// <summary>
/// Persists optional proxy settings (server/port/user/password/domain) for
/// networks that require one to reach the SaaS API. Kept out of
/// appsettings.json and encrypted at rest via DPAPI (machine scope), same
/// pattern and same reasoning as <see cref="AgentCredentialStore"/> — a
/// proxy password is a secret just like the Agent's own API key.
/// </summary>
public class AgentProxyStore
{
    private readonly string _path;
    private readonly ILogger<AgentProxyStore> _logger;

    public AgentProxyStore(ILogger<AgentProxyStore> logger)
    {
        _logger = logger;
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "PrinterSaaS", "Agent");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "proxy.dat");
    }

    public AgentProxySettings? Load()
    {
        if (!File.Exists(_path))
        {
            return null;
        }
        try
        {
            var encrypted = File.ReadAllBytes(_path);
            var json = Unprotect(encrypted);
            return JsonSerializer.Deserialize<AgentProxySettings>(json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load stored proxy settings — proxy will be disabled until reconfigured");
            return null;
        }
    }

    public void Save(AgentProxySettings settings)
    {
        var json = JsonSerializer.Serialize(settings);
        var encrypted = Protect(json);
        File.WriteAllBytes(_path, encrypted);
    }

    public void Clear()
    {
        if (File.Exists(_path))
        {
            File.Delete(_path);
        }
    }

    [SupportedOSPlatform("windows")]
    private static byte[] Protect(string plainText)
    {
        var bytes = Encoding.UTF8.GetBytes(plainText);
        return ProtectedData.Protect(bytes, null, DataProtectionScope.LocalMachine);
    }

    [SupportedOSPlatform("windows")]
    private static string Unprotect(byte[] encrypted)
    {
        var bytes = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.LocalMachine);
        return Encoding.UTF8.GetString(bytes);
    }
}
