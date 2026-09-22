using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Security;

namespace PrinterAgent.Core.Snmp;

/// <summary>
/// Builds SNMP v3 security providers (authentication and privacy) based on
/// credentials (spec §16). Supports MD5/SHA1/SHA256/SHA384/SHA512 for
/// authentication and DES/AES128/AES192/AES256 for privacy.
/// </summary>
public static class SnmpV3SecurityProvider
{
    /// <summary>
    /// Creates the appropriate IPrivacyProvider based on the credentials and
    /// security level. For noAuthNoPriv, returns DefaultPrivacyProvider.
    /// For authNoPriv, returns authentication-only provider.
    /// For authPriv, returns provider with both authentication and privacy.
    /// </summary>
    public static IPrivacyProvider CreateProvider(SnmpV3Credentials credentials)
    {
        if (credentials.IsNoAuthNoPriv)
        {
            return DefaultPrivacyProvider.DefaultPair;
        }

        var authProvider = CreateAuthenticationProvider(credentials);

        if (credentials.IsAuthNoPriv)
        {
            return DefaultPrivacyProvider.DefaultPair;
        }

        // authPriv - add privacy
        var privProvider = CreatePrivacyProvider(credentials, authProvider);
        return privProvider;
    }

    private static object CreateAuthenticationProvider(SnmpV3Credentials credentials)
    {
        var protocol = credentials.AuthenticationProtocol?.ToLowerInvariant() ?? "sha1";
        var password = new OctetString(credentials.AuthenticationPassword!);

        return protocol switch
        {
            "md5" => new MD5AuthenticationProvider(password),
            "sha1" => new SHA1AuthenticationProvider(password),
            "sha256" => new SHA256AuthenticationProvider(password),
            "sha384" => new SHA384AuthenticationProvider(password),
            "sha512" => new SHA512AuthenticationProvider(password),
            _ => throw new ArgumentException($"Unsupported authentication protocol: {protocol}")
        };
    }

    private static IPrivacyProvider CreatePrivacyProvider(SnmpV3Credentials credentials, object authProvider)
    {
        var protocol = credentials.PrivacyProtocol?.ToLowerInvariant() ?? "des";
        var password = new OctetString(credentials.PrivacyPassword!);

        return protocol switch
        {
            "des" => new DESPrivacyProvider(password, (IAuthenticationProvider)authProvider),
            "aes" => new AESPrivacyProvider(password, (IAuthenticationProvider)authProvider),
            "aes128" => new AESPrivacyProvider(password, (IAuthenticationProvider)authProvider),
            "aes192" => new AESPrivacyProvider(password, (IAuthenticationProvider)authProvider),
            "aes256" => new AESPrivacyProvider(password, (IAuthenticationProvider)authProvider),
            _ => throw new ArgumentException($"Unsupported privacy protocol: {protocol}")
        };
    }

    /// <summary>
    /// Gets the security level as a Levels enum value for SharpSnmpLib.
    /// </summary>
    public static Levels GetSecurityLevel(SnmpV3Credentials credentials)
    {
        return credentials.SecurityLevel.ToLowerInvariant() switch
        {
            "noauthnopriv" => Levels.Reportable,
            "authnopriv" => Levels.Authentication | Levels.Reportable,
            "authpriv" => Levels.Authentication | Levels.Privacy | Levels.Reportable,
            _ => throw new ArgumentException($"Invalid security level: {credentials.SecurityLevel}")
        };
    }
}
