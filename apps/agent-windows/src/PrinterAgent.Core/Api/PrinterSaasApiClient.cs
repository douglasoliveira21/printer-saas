using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using PrinterAgent.Core.Configuration;
using PrinterAgent.Core.Models;

namespace PrinterAgent.Core.Api;

/// <summary>
/// Thin wrapper around the Agent-facing endpoints documented in
/// docs/agent.md — <c>/api/v1/agent-api/v1/*</c>. Every call the Agent
/// makes to the SaaS goes through here, and only here (spec §38).
/// </summary>
public class PrinterSaasApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _http;
    private readonly AgentCredentialStore _credentialStore;
    private readonly ILogger<PrinterSaasApiClient> _logger;

    public PrinterSaasApiClient(HttpClient http, AgentCredentialStore credentialStore, ILogger<PrinterSaasApiClient> logger)
    {
        _http = http;
        _credentialStore = credentialStore;
        _logger = logger;
    }

    /// <summary>
    /// Loads the stored credential fresh from disk and applies it to THIS
    /// instance's HttpClient. Typed HttpClients are transient by default
    /// (see AddHttpClient in Program.cs), so different call sites
    /// (AgentEnrollmentService, AgentWorker) can each get their own
    /// PrinterSaasApiClient/HttpClient pair — setting the header once on
    /// one instance would silently leave the others unauthenticated. Doing
    /// this per-call is a little wasteful (one file read) but correct
    /// regardless of which instance is in play.
    /// </summary>
    private void ApplyStoredCredentials()
    {
        var credentials = _credentialStore.Load();
        if (credentials is not null)
        {
            _http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("AgentKey", $"{credentials.AgentId}.{credentials.ApiKeySecret}");
        }
    }

    public async Task<EnrollResponse> EnrollAsync(EnrollRequest request, CancellationToken ct)
    {
        var response = await _http.PostAsJsonAsync("api/v1/agent-api/v1/enroll", request, JsonOptions, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<EnrollResponse>(JsonOptions, ct);
        return body ?? throw new InvalidOperationException("Empty response from /enroll");
    }

    public async Task<bool> HeartbeatAsync(HeartbeatRequest request, CancellationToken ct)
    {
        try
        {
            ApplyStoredCredentials();
            var response = await _http.PostAsJsonAsync("api/v1/agent-api/v1/heartbeat", request, JsonOptions, ct);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Heartbeat failed (will retry next cycle)");
            return false;
        }
    }

    public async Task<AgentConfigResponse?> GetConfigAsync(CancellationToken ct)
    {
        try
        {
            ApplyStoredCredentials();
            var response = await _http.GetAsync("api/v1/agent-api/v1/config", ct);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }
            return await response.Content.ReadFromJsonAsync<AgentConfigResponse>(JsonOptions, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch remote config (keeping current local config)");
            return null;
        }
    }

    /// <returns>True if the SaaS accepted the batch; false means the caller should keep it queued.</returns>
    public async Task<bool> SubmitDevicesAsync(SubmitDevicesRequest request, CancellationToken ct)
    {
        try
        {
            ApplyStoredCredentials();
            var response = await _http.PostAsJsonAsync("api/v1/agent-api/v1/devices", request, JsonOptions, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Device submission rejected: {Status}", response.StatusCode);
            }
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Device submission failed (network) — queuing for retry");
            return false;
        }
    }
}
