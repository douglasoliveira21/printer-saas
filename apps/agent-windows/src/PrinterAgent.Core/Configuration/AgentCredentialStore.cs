using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace PrinterAgent.Core.Configuration;

/// <summary>
/// Persists the Agent's permanent credentials (issued at enrollment — see
/// spec §12-13). The secret half of the API key is encrypted at rest with
/// Windows DPAPI (machine scope, so it survives service restarts run under
/// LocalSystem) instead of ever touching disk as plain text (spec §40).
/// Never stores a human user's password or a platform-wide secret — each
/// Agent's credential is unique to it.
/// </summary>
public class AgentCredentialStore
{
    private readonly string _path;
    private readonly ILogger<AgentCredentialStore> _logger;

    public AgentCredentialStore(ILogger<AgentCredentialStore> logger)
    {
        _logger = logger;
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "PrinterSaaS", "Agent");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "credentials.dat");
    }

    public bool Exists => File.Exists(_path);

    public AgentCredentials? Load()
    {
        if (!File.Exists(_path))
        {
            return null;
        }

        try
        {
            var encrypted = File.ReadAllBytes(_path);
            var json = Unprotect(encrypted);
            return JsonSerializer.Deserialize<AgentCredentials>(json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load stored agent credentials; re-enrollment will be required");
            return null;
        }
    }

    public void Save(AgentCredentials credentials)
    {
        var json = JsonSerializer.Serialize(credentials);
        var encrypted = Protect(json);
        File.WriteAllBytes(_path, encrypted);
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
