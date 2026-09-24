using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

namespace PrinterAgent.ConfigTool;

public record EnrollmentLookupResult(string AgentName, string? CustomerName);

/// <summary>
/// Read-only check of an install token — calls GET /agent-api/v1/enroll/lookup
/// so the setup screen can show "é este o cliente mesmo?" before actually
/// installing. Deliberately a bare HttpClient, not PrinterAgent.Core's
/// PrinterSaasApiClient: this runs in the ConfigTool (WPF, no DI container)
/// before the service — and often before it even exists on this machine —
/// so there's no AgentOptions/AgentCredentialStore to wire up for a single
/// unauthenticated GET.
/// </summary>
public static class EnrollmentLookupClient
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <summary>Returns null (never throws) on any failure — invalid token, expired, network error — the caller shows a single generic message either way.</summary>
    public static async Task<EnrollmentLookupResult?> LookupAsync(string apiUrl, string token)
    {
        try
        {
            using var http = new HttpClient { BaseAddress = new Uri(apiUrl), Timeout = TimeSpan.FromSeconds(10) };
            var response = await http.GetAsync($"api/v1/agent-api/v1/enroll/lookup?token={Uri.EscapeDataString(token)}");
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }
            return await response.Content.ReadFromJsonAsync<EnrollmentLookupResult>(JsonOptions);
        }
        catch
        {
            return null;
        }
    }
}
