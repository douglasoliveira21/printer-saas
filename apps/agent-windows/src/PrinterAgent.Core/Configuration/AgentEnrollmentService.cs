using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PrinterAgent.Core.Api;
using PrinterAgent.Core.Models;

namespace PrinterAgent.Core.Configuration;

/// <summary>
/// Ensures the Agent has a permanent credential before doing anything else
/// (spec §12-13): loads it from local storage if present, otherwise
/// redeems the one-time enrollment token from appsettings.json exactly
/// once. The enrollment token is never reused for authenticated calls.
/// </summary>
public class AgentEnrollmentService
{
    private readonly PrinterSaasApiClient _apiClient;
    private readonly AgentCredentialStore _store;
    private readonly AgentOptions _options;
    private readonly ILogger<AgentEnrollmentService> _logger;

    public AgentEnrollmentService(
        PrinterSaasApiClient apiClient,
        AgentCredentialStore store,
        IOptions<AgentOptions> options,
        ILogger<AgentEnrollmentService> logger)
    {
        _apiClient = apiClient;
        _store = store;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<AgentCredentials> EnsureEnrolledAsync(CancellationToken ct)
    {
        var existing = _store.Load();
        if (existing is not null)
        {
            return existing;
        }

        if (string.IsNullOrWhiteSpace(_options.EnrollmentToken))
        {
            throw new InvalidOperationException(
                "No stored credentials and no EnrollmentToken configured. " +
                "Set Agent:EnrollmentToken in appsettings.json (from 'Adicionar Agent' in the SaaS) and restart the service.");
        }

        _logger.LogInformation("Redeeming enrollment token...");
        var response = await _apiClient.EnrollAsync(
            new EnrollRequest
            {
                EnrollmentToken = _options.EnrollmentToken,
                Hostname = Environment.MachineName,
                AgentVersion = AgentVersion.Current,
            },
            ct);

        // apiKey comes back as "<agentId>.<secret>" — split off just the
        // secret half; AgentId is already given separately in the response.
        var secret = response.ApiKey[(response.ApiKey.IndexOf('.') + 1)..];
        var credentials = new AgentCredentials(response.AgentId, secret);

        _store.Save(credentials);
        _logger.LogInformation("Enrollment successful. AgentId: {AgentId}", credentials.AgentId);
        return credentials;
    }
}

public static class AgentVersion
{
    public const string Current = "1.0.2";
}
