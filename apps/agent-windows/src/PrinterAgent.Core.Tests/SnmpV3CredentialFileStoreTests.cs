using Microsoft.Extensions.Logging.Abstractions;
using PrinterAgent.Core.Configuration;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>Fase 6 (segurança das credenciais SNMP) — cada teste usa seu próprio arquivo isolado, nunca toca o ProgramData real.</summary>
public class SnmpV3CredentialFileStoreTests : IDisposable
{
    private readonly string _tempDir;
    private readonly string _credentialPath;
    private readonly string _appsettingsPath;

    public SnmpV3CredentialFileStoreTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "PrinterAgentTests_Snmp_" + Guid.NewGuid());
        Directory.CreateDirectory(_tempDir);
        _credentialPath = Path.Combine(_tempDir, "snmpv3-credentials.dat");
        _appsettingsPath = Path.Combine(_tempDir, "appsettings.json");
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    private SnmpV3CredentialFileStore CreateStore() => new(_credentialPath, NullLogger<SnmpV3CredentialFileStore>.Instance);

    [Fact]
    public void Save_then_Load_roundtrips_the_credential()
    {
        var store = CreateStore();
        var credentials = new StoredSnmpV3Credentials
        {
            UserName = "monitor",
            SecurityLevel = "authPriv",
            AuthenticationProtocol = "SHA256",
            AuthenticationPassword = "auth-secret",
            PrivacyProtocol = "AES128",
            PrivacyPassword = "priv-secret",
        };

        store.Save(credentials);
        var loaded = store.Load();

        Assert.Equal("monitor", loaded?.UserName);
        Assert.Equal("auth-secret", loaded?.AuthenticationPassword);
        Assert.Equal("priv-secret", loaded?.PrivacyPassword);
    }

    [Fact]
    public void Load_when_file_never_existed_returns_null()
    {
        var store = CreateStore();

        Assert.Null(store.Load());
    }

    [Fact]
    public void Credential_file_on_disk_never_contains_the_plain_password_text()
    {
        var store = CreateStore();
        store.Save(new StoredSnmpV3Credentials { UserName = "monitor", AuthenticationPassword = "super-secret-value", PrivacyPassword = "another-secret" });

        var rawBytes = File.ReadAllBytes(_credentialPath);
        var rawAsText = System.Text.Encoding.UTF8.GetString(rawBytes);

        Assert.DoesNotContain("super-secret-value", rawAsText);
        Assert.DoesNotContain("another-secret", rawAsText);
    }

    [Fact]
    public void LoadOrMigrate_sem_appsettings_e_sem_fallback_nao_migra_nada()
    {
        var store = CreateStore();

        var result = store.LoadOrMigrate(null, _appsettingsPath);

        Assert.Null(result);
        Assert.False(File.Exists(_credentialPath));
    }

    [Fact]
    public void LoadOrMigrate_com_SnmpV3_configurado_em_texto_plano_migra_para_o_arquivo_criptografado()
    {
        File.WriteAllText(_appsettingsPath, """
            {
              "Agent": {
                "SnmpV3": {
                  "UserName": "monitor",
                  "SecurityLevel": "authPriv",
                  "AuthenticationProtocol": "SHA256",
                  "AuthenticationPassword": "auth-secret",
                  "PrivacyProtocol": "AES128",
                  "PrivacyPassword": "priv-secret"
                }
              }
            }
            """);
        var store = CreateStore();
        var plaintextFallback = new PrinterAgent.Core.Configuration.SnmpV3Options
        {
            UserName = "monitor",
            SecurityLevel = "authPriv",
            AuthenticationProtocol = "SHA256",
            AuthenticationPassword = "auth-secret",
            PrivacyProtocol = "AES128",
            PrivacyPassword = "priv-secret",
        };

        var result = store.LoadOrMigrate(plaintextFallback, _appsettingsPath);

        Assert.NotNull(result);
        Assert.Equal("monitor", result!.UserName);
        Assert.Equal("auth-secret", result.AuthenticationPassword);
        Assert.True(File.Exists(_credentialPath));

        // O appsettings.json não deve mais conter as senhas em texto plano.
        var scrubbed = File.ReadAllText(_appsettingsPath);
        Assert.DoesNotContain("auth-secret", scrubbed);
        Assert.DoesNotContain("priv-secret", scrubbed);
        // Mas o username continua visível (não é o segredo).
        Assert.Contains("monitor", scrubbed);
    }

    [Fact]
    public void LoadOrMigrate_chamado_duas_vezes_nao_migra_de_novo_e_nao_perde_o_valor_ja_salvo()
    {
        var store = CreateStore();
        store.Save(new StoredSnmpV3Credentials { UserName = "ja-configurado", AuthenticationPassword = "original" });

        // Mesmo passando um fallback plaintext diferente, o arquivo
        // criptografado já existente é quem manda — nunca sobrescrito.
        var result = store.LoadOrMigrate(
            new PrinterAgent.Core.Configuration.SnmpV3Options { UserName = "outro-usuario", AuthenticationPassword = "outra-senha" },
            _appsettingsPath);

        Assert.Equal("ja-configurado", result?.UserName);
        Assert.Equal("original", result?.AuthenticationPassword);
    }
}
