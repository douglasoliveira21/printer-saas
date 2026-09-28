using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace PrinterAgent.Core.Configuration;

/// <summary>Same shape as SnmpV3Options, just without the leftover appsettings.json binding semantics — this is what actually persists to disk.</summary>
public class StoredSnmpV3Credentials
{
    public string? UserName { get; set; }
    public string SecurityLevel { get; set; } = "authPriv";
    public string? AuthenticationProtocol { get; set; }
    public string? AuthenticationPassword { get; set; }
    public string? PrivacyProtocol { get; set; }
    public string? PrivacyPassword { get; set; }
    public string? ContextName { get; set; }
}

/// <summary>
/// Fase 6 (segurança das credenciais SNMP): the local SNMPv3 fallback
/// (only ever used before the Agent's first successful GET /config poll,
/// or when the server has nothing configured for it — see
/// SnmpV3CredentialStore's own doc comment) used to live as plain text in
/// appsettings.json's "Agent:SnmpV3" section. Same DPAPI-at-rest treatment
/// AgentCredentialStore already gives the permanent API key, applied here
/// to the one genuinely sensitive part of that section — the authentication
/// and privacy passwords. (SnmpCommunity, used by v1/v2c, is deliberately
/// NOT covered here: SNMPv1/v2c always sends it unencrypted on the wire to
/// every printer it talks to, so protecting it at rest gives no real
/// security benefit while touching several other call sites that already
/// read/write it directly as plain config.)
/// </summary>
public class SnmpV3CredentialFileStore
{
    private readonly string _path;
    private readonly ILogger<SnmpV3CredentialFileStore> _logger;

    public SnmpV3CredentialFileStore(ILogger<SnmpV3CredentialFileStore> logger)
    {
        _logger = logger;
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "PrinterSaaS", "Agent");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "snmpv3-credentials.dat");
    }

    /// <summary>Test-only seam — points the store at an arbitrary file instead of the real ProgramData path.</summary>
    internal SnmpV3CredentialFileStore(string credentialFilePath, ILogger<SnmpV3CredentialFileStore> logger)
    {
        _logger = logger;
        Directory.CreateDirectory(Path.GetDirectoryName(credentialFilePath)!);
        _path = credentialFilePath;
    }

    public StoredSnmpV3Credentials? Load()
    {
        if (!File.Exists(_path))
        {
            return null;
        }
        try
        {
            var encrypted = File.ReadAllBytes(_path);
            var json = Unprotect(encrypted);
            return JsonSerializer.Deserialize<StoredSnmpV3Credentials>(json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load stored SNMPv3 credentials — SNMPv3 local fallback disabled until reconfigured");
            return null;
        }
    }

    public void Save(StoredSnmpV3Credentials credentials)
    {
        var json = JsonSerializer.Serialize(credentials);
        var encrypted = Protect(json);
        File.WriteAllBytes(_path, encrypted);
    }

    /// <summary>
    /// Called once at startup (Service and ConfigTool both call this, so
    /// whichever runs first performs the migration — idempotent either
    /// way). If the encrypted store already exists, that's authoritative —
    /// no plaintext to migrate. Otherwise, if appsettings.json has a
    /// hand-configured "SnmpV3" section (there's no GUI for this; a user
    /// or support tech edited the file directly), copy it into the
    /// encrypted store, then scrub just the two password fields from
    /// appsettings.json so they stop sitting there in plain text — the rest
    /// of the section (username, protocols) stays visible for a human
    /// glancing at the file to see what's configured.
    /// </summary>
    public StoredSnmpV3Credentials? LoadOrMigrate(SnmpV3Options? plaintextFallback, string appsettingsPath)
    {
        var stored = Load();
        if (stored is not null)
        {
            return stored;
        }
        if (string.IsNullOrWhiteSpace(plaintextFallback?.UserName))
        {
            return null;
        }

        var migrated = new StoredSnmpV3Credentials
        {
            UserName = plaintextFallback.UserName,
            SecurityLevel = plaintextFallback.SecurityLevel,
            AuthenticationProtocol = plaintextFallback.AuthenticationProtocol,
            AuthenticationPassword = plaintextFallback.AuthenticationPassword,
            PrivacyProtocol = plaintextFallback.PrivacyProtocol,
            PrivacyPassword = plaintextFallback.PrivacyPassword,
            ContextName = plaintextFallback.ContextName,
        };
        Save(migrated);
        ScrubPasswordsFromAppSettings(appsettingsPath);
        _logger.LogInformation("Migrated SNMPv3 credentials from appsettings.json to encrypted local storage.");
        return migrated;
    }

    private void ScrubPasswordsFromAppSettings(string appsettingsPath)
    {
        try
        {
            if (!File.Exists(appsettingsPath))
            {
                return;
            }
            var json = File.ReadAllText(appsettingsPath);
            var root = JsonSerializer.Deserialize<Dictionary<string, object>>(json);
            if (root is null || !root.TryGetValue("Agent", out var agentObj))
            {
                return;
            }
            var agentSection = JsonSerializer.Deserialize<Dictionary<string, object>>(JsonSerializer.Serialize(agentObj));
            if (agentSection is null || !agentSection.TryGetValue("SnmpV3", out var v3Obj))
            {
                return;
            }
            var v3Section = JsonSerializer.Deserialize<Dictionary<string, object>>(JsonSerializer.Serialize(v3Obj));
            if (v3Section is null)
            {
                return;
            }
            v3Section["AuthenticationPassword"] = "";
            v3Section["PrivacyPassword"] = "";
            agentSection["SnmpV3"] = v3Section;
            root["Agent"] = agentSection;
            File.WriteAllText(appsettingsPath, JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch (Exception ex)
        {
            // Best-effort — the encrypted copy already has what matters;
            // failing to scrub the old plaintext file isn't worth crashing
            // startup over.
            _logger.LogWarning(ex, "Migrated SNMPv3 credentials to encrypted storage, but failed to scrub the plaintext copy from appsettings.json");
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
