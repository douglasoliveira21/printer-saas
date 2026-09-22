using System.Net;
using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Messaging;
using Microsoft.Extensions.Logging;

namespace PrinterAgent.Core.Snmp;

/// <summary>
/// Performs SNMP v3 engine discovery (spec §16). SNMP v3 requires an initial
/// discovery request to obtain the engine ID, engine boots, and engine time
/// from the target device before actual queries can be made. This class
/// handles that discovery process and caches the report message for reuse.
/// </summary>
public class SnmpV3EngineDiscovery
{
    private readonly ILogger<SnmpV3EngineDiscovery> _logger;
    private readonly Dictionary<string, ISnmpMessage> _engineCache = new();
    private readonly SemaphoreSlim _cacheLock = new(1, 1);

    public SnmpV3EngineDiscovery(ILogger<SnmpV3EngineDiscovery> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Performs engine discovery for the given endpoint and returns the report
    /// message. Results are cached per endpoint to avoid repeated discovery.
    /// </summary>
    public async Task<ISnmpMessage?> DiscoverAsync(IPEndPoint endpoint, int timeoutMs, CancellationToken ct)
    {
        var cacheKey = endpoint.ToString();

        // Check cache first
        await _cacheLock.WaitAsync(ct);
        try
        {
            if (_engineCache.TryGetValue(cacheKey, out var cachedReport))
            {
                _logger.LogDebug("Using cached engine discovery for {Endpoint}", endpoint);
                return cachedReport;
            }
        }
        finally
        {
            _cacheLock.Release();
        }

        // Perform discovery
        try
        {
            _logger.LogDebug("Performing SNMP v3 engine discovery for {Endpoint}", endpoint);
            
            var discovery = Messenger.GetNextDiscovery(SnmpType.GetRequestPdu);
            var report = await Task.Run(() => discovery.GetResponseAsync(endpoint));

            if (report is null)
            {
                _logger.LogWarning("SNMP v3 engine discovery failed for {Endpoint} - no response", endpoint);
                return null;
            }

            // Cache the result
            await _cacheLock.WaitAsync(ct);
            try
            {
                _engineCache[cacheKey] = report;
                _logger.LogDebug("SNMP v3 engine discovery successful for {Endpoint}", endpoint);
            }
            finally
            {
                _cacheLock.Release();
            }

            return report;
        }
        catch (System.TimeoutException ex)
        {
            _logger.LogWarning(ex, "SNMP v3 engine discovery timed out for {Endpoint}", endpoint);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SNMP v3 engine discovery failed for {Endpoint}", endpoint);
            return null;
        }
    }

    /// <summary>
    /// Clears the engine discovery cache. Call this when device configuration
    /// changes or when engines might have been restarted.
    /// </summary>
    public async Task ClearCacheAsync()
    {
        await _cacheLock.WaitAsync();
        try
        {
            _engineCache.Clear();
            _logger.LogDebug("SNMP v3 engine discovery cache cleared");
        }
        finally
        {
            _cacheLock.Release();
        }
    }

    /// <summary>
    /// Clears the cache for a specific endpoint only.
    /// </summary>
    public async Task ClearCacheAsync(IPEndPoint endpoint)
    {
        var cacheKey = endpoint.ToString();
        await _cacheLock.WaitAsync();
        try
        {
            _engineCache.Remove(cacheKey);
            _logger.LogDebug("SNMP v3 engine discovery cache cleared for {Endpoint}", endpoint);
        }
        finally
        {
            _cacheLock.Release();
        }
    }
}
