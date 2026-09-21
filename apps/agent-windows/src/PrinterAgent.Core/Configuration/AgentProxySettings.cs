namespace PrinterAgent.Core.Configuration;

public record AgentProxySettings(string? Server, int? Port, string? Username, string? Password, string? Domain)
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(Server) && Port is > 0;
}
