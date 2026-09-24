using System.Runtime.InteropServices;
using System.Security.Cryptography.X509Certificates;

namespace PrinterAgent.Core.Update;

/// <summary>
/// Verifies a downloaded update package is (a) genuinely Authenticode-signed
/// and the signature/certificate chain is valid per Windows' own trust
/// engine, and (b) signed specifically by the Vgon Printer publishing
/// certificate — not just "signed by someone Windows happens to trust".
///
/// (b) is the actual security boundary for auto-update: without it, any
/// validly-signed executable from any publisher (including a compromised
/// download host serving a validly-signed decoy) would pass. The expected
/// thumbprint is a compiled-in constant, never something the server response
/// supplies — see AgentUpdateChecker, which never lets the server tell the
/// Agent what to trust.
///
/// Uses WinVerifyTrust (wintrust.dll) via P/Invoke — the actual OS API
/// Windows itself uses for driver/Authenticode signature verification, not
/// a shell-out to signtool.exe (a Windows SDK tool, not guaranteed present
/// on a random machine).
/// </summary>
public static class AuthenticodeVerifier
{
    /// <summary>
    /// PLACEHOLDER — this is the thumbprint of a locally-generated self-signed
    /// test certificate (see installer/codesign/README.md), used only to
    /// validate this verification logic end-to-end during development.
    /// Replace with the real thumbprint of your purchased code-signing
    /// certificate before shipping auto-update to any real Agent, and every
    /// release .msi must be signed with that same certificate (signtool.exe
    /// sign /sha1 &lt;thumbprint&gt; ... PrinterAgentSetup.msi) or every Agent
    /// will correctly refuse to install it.
    /// </summary>
    public const string ExpectedThumbprint = "0000000000000000000000000000000000000000";

    /// <summary>
    /// True only if the file has a valid Authenticode signature (per
    /// Windows' own trust chain validation) AND the signing certificate's
    /// thumbprint matches <see cref="ExpectedThumbprint"/> exactly.
    /// </summary>
    public static bool Verify(string filePath, out string reason)
    {
        if (!File.Exists(filePath))
        {
            reason = "File does not exist.";
            return false;
        }

        if (!WinVerifyTrustSignatureIsValid(filePath, out var trustReason))
        {
            reason = $"Authenticode signature invalid: {trustReason}";
            return false;
        }

        string thumbprint;
        try
        {
            // X509Certificate.CreateFromSignedFile is marked obsolete
            // (SYSLIB0057) in favor of X509CertificateLoader, but that
            // replacement has no equivalent for "extract the embedded
            // Authenticode signing cert from a signed executable" as of
            // .NET 10 — it only loads standalone cert/PFX files. This is
            // still the only built-in way to do this specific thing.
#pragma warning disable SYSLIB0057
            using var cert = new X509Certificate2(X509Certificate.CreateFromSignedFile(filePath));
#pragma warning restore SYSLIB0057
            thumbprint = cert.Thumbprint ?? string.Empty;
        }
        catch (Exception ex)
        {
            reason = $"Could not read signing certificate: {ex.Message}";
            return false;
        }

        if (!string.Equals(thumbprint, ExpectedThumbprint, StringComparison.OrdinalIgnoreCase))
        {
            reason = $"Signed by an unexpected certificate (thumbprint {thumbprint}, expected {ExpectedThumbprint}).";
            return false;
        }

        reason = "OK";
        return true;
    }

    private static bool WinVerifyTrustSignatureIsValid(string filePath, out string reason)
    {
        var fileInfo = new WINTRUST_FILE_INFO
        {
            cbStruct = (uint)Marshal.SizeOf<WINTRUST_FILE_INFO>(),
            pcwszFilePath = filePath,
            hFile = IntPtr.Zero,
            pgKnownSubject = IntPtr.Zero,
        };

        var fileInfoPtr = Marshal.AllocHGlobal(Marshal.SizeOf<WINTRUST_FILE_INFO>());
        try
        {
            Marshal.StructureToPtr(fileInfo, fileInfoPtr, false);

            var trustData = new WINTRUST_DATA
            {
                cbStruct = (uint)Marshal.SizeOf<WINTRUST_DATA>(),
                pPolicyCallbackData = IntPtr.Zero,
                pSIPClientData = IntPtr.Zero,
                dwUIChoice = WTD_UI_NONE,
                fdwRevocationChecks = WTD_REVOKE_NONE, // no network revocation check — Agent machines may be offline/behind restrictive firewalls; chain-of-trust validation alone is still the real check
                dwUnionChoice = WTD_CHOICE_FILE,
                pFile = fileInfoPtr,
                dwStateAction = WTD_STATEACTION_VERIFY,
                hWVTStateData = IntPtr.Zero,
                pwszURLReference = IntPtr.Zero,
                dwProvFlags = WTD_SAFER_FLAG,
                dwUIContext = 0,
            };

            var actionGuid = WINTRUST_ACTION_GENERIC_VERIFY_V2;
            var result = WinVerifyTrust(IntPtr.Zero, ref actionGuid, ref trustData);

            // Always release the trust provider's state, even on failure —
            // WTD_STATEACTION_CLOSE, per the documented WinVerifyTrust
            // contract, regardless of the verify result above.
            trustData.dwStateAction = WTD_STATEACTION_CLOSE;
            WinVerifyTrust(IntPtr.Zero, ref actionGuid, ref trustData);

            if (result == 0)
            {
                reason = "OK";
                return true;
            }

            reason = $"WinVerifyTrust returned 0x{result:X8}";
            return false;
        }
        finally
        {
            Marshal.FreeHGlobal(fileInfoPtr);
        }
    }

    private const uint WTD_UI_NONE = 2;
    private const uint WTD_REVOKE_NONE = 0;
    private const uint WTD_CHOICE_FILE = 1;
    private const uint WTD_STATEACTION_VERIFY = 1;
    private const uint WTD_STATEACTION_CLOSE = 2;
    private const uint WTD_SAFER_FLAG = 0x100;

    private static Guid WINTRUST_ACTION_GENERIC_VERIFY_V2 = new("00AAC56B-CD44-11d0-8CC2-00C04FC295EE");

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WINTRUST_FILE_INFO
    {
        public uint cbStruct;
        public string pcwszFilePath;
        public IntPtr hFile;
        public IntPtr pgKnownSubject;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WINTRUST_DATA
    {
        public uint cbStruct;
        public IntPtr pPolicyCallbackData;
        public IntPtr pSIPClientData;
        public uint dwUIChoice;
        public uint fdwRevocationChecks;
        public uint dwUnionChoice;
        public IntPtr pFile;
        public uint dwStateAction;
        public IntPtr hWVTStateData;
        public IntPtr pwszURLReference;
        public uint dwProvFlags;
        public uint dwUIContext;
    }

    [DllImport("wintrust.dll", ExactSpelling = true, SetLastError = false, CharSet = CharSet.Unicode)]
    private static extern uint WinVerifyTrust(IntPtr hwnd, ref Guid pgActionID, ref WINTRUST_DATA pWVTData);
}
