using Lextm.SharpSnmpLib;
using PrinterAgent.Core.Configuration;

namespace PrinterAgent.Core.Snmp;

/// <summary>
/// Validates and holds SNMP v3 credentials (spec §16). Provides helper methods
/// to determine the security level and validate required fields.
/// </summary>
public class SnmpV3Credentials
{
    public string UserName { get; }
    public string SecurityLevel { get; }
    public string? AuthenticationProtocol { get; }
    public string? AuthenticationPassword { get; }
    public string? PrivacyProtocol { get; }
    public string? PrivacyPassword { get; }
    public string? ContextName { get; }

    public SnmpV3Credentials(SnmpV3Options options)
    {
        if (options is null)
        {
            throw new ArgumentNullException(nameof(options));
        }

        if (string.IsNullOrWhiteSpace(options.UserName))
        {
            throw new ArgumentException("SNMP v3 requires a non-empty UserName.", nameof(options));
        }

        UserName = options.UserName;
        SecurityLevel = options.SecurityLevel?.ToLowerInvariant() ?? "authpriv";
        AuthenticationProtocol = options.AuthenticationProtocol;
        AuthenticationPassword = options.AuthenticationPassword;
        PrivacyProtocol = options.PrivacyProtocol;
        PrivacyPassword = options.PrivacyPassword;
        ContextName = options.ContextName;

        Validate();
    }

    private void Validate()
    {
        // Validate security level
        if (SecurityLevel != "noauthnopriv" && SecurityLevel != "authnopriv" && SecurityLevel != "authpriv")
        {
            throw new ArgumentException($"Invalid SecurityLevel: {SecurityLevel}. Must be noAuthNoPriv, authNoPriv, or authPriv.");
        }

        // Validate authentication requirements
        if (SecurityLevel == "authnopriv" || SecurityLevel == "authpriv")
        {
            if (string.IsNullOrWhiteSpace(AuthenticationProtocol))
            {
                throw new ArgumentException($"AuthenticationProtocol is required for security level {SecurityLevel}.");
            }

            if (string.IsNullOrWhiteSpace(AuthenticationPassword))
            {
                throw new ArgumentException($"AuthenticationPassword is required for security level {SecurityLevel}.");
            }

            // Validate authentication protocol
            var validAuthProtocols = new[] { "md5", "sha1", "sha256", "sha384", "sha512" };
            if (!validAuthProtocols.Contains(AuthenticationProtocol.ToLowerInvariant()))
            {
                throw new ArgumentException($"Invalid AuthenticationProtocol: {AuthenticationProtocol}. Must be MD5, SHA1, SHA256, SHA384, or SHA512.");
            }
        }

        // Validate privacy requirements
        if (SecurityLevel == "authpriv")
        {
            if (string.IsNullOrWhiteSpace(PrivacyProtocol))
            {
                throw new ArgumentException($"PrivacyProtocol is required for security level authPriv.");
            }

            if (string.IsNullOrWhiteSpace(PrivacyPassword))
            {
                throw new ArgumentException($"PrivacyPassword is required for security level authPriv.");
            }

            // Validate privacy protocol
            var validPrivProtocols = new[] { "des", "aes128", "aes192", "aes256" };
            if (!validPrivProtocols.Contains(PrivacyProtocol.ToLowerInvariant()))
            {
                throw new ArgumentException($"Invalid PrivacyProtocol: {PrivacyProtocol}. Must be DES, AES128, AES192, or AES256.");
            }
        }
    }

    /// <summary>
    /// Determines if this is a noAuthNoPriv configuration (least secure).
    /// </summary>
    public bool IsNoAuthNoPriv => SecurityLevel == "noauthnopriv";

    /// <summary>
    /// Determines if this is an authNoPriv configuration (authentication only).
    /// </summary>
    public bool IsAuthNoPriv => SecurityLevel == "authnopriv";

    /// <summary>
    /// Determines if this is an authPriv configuration (authentication + privacy).
    /// </summary>
    public bool IsAuthPriv => SecurityLevel == "authpriv";

    /// <summary>
    /// Gets the context name as an OctetString (empty if not configured).
    /// </summary>
    public OctetString GetContextName() => string.IsNullOrWhiteSpace(ContextName) 
        ? OctetString.Empty 
        : new OctetString(ContextName);
}
