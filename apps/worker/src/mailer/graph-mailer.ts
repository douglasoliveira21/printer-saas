import { Logger } from '@nestjs/common';

const logger = new Logger('GraphMailer');

interface GraphCredentials {
  tenantId: string; // Azure AD directory (tenant) id — NOT this app's own tenantId
  clientId: string;
  clientSecret: string;
  senderUpn: string; // mailbox sending as, e.g. relatorios@empresa.com.br
}

// One cached app-only token per Azure AD app registration (keyed by
// tenantId:clientId), refreshed a minute before it actually expires.
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

async function getAccessToken(creds: GraphCredentials): Promise<string> {
  const cacheKey = `${creds.tenantId}:${creds.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const response = await fetch(`https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao autenticar no Azure AD (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 });
  return json.access_token;
}

/**
 * Sends via Microsoft Graph's app-only `POST /users/{upn}/sendMail`
 * (client-credentials OAuth2) instead of SMTP — requires an Azure AD App
 * Registration in the tenant's own Microsoft 365 directory with the
 * `Mail.Send` **application** permission, admin-consented. That app
 * registration is something only the customer's own Microsoft 365 admin can
 * create; this code just uses whatever client id/secret/sender they paste
 * into Configurações > E-mail.
 */
interface DelegatedGraphCredentials {
  clientId: string; // App Registration único da Plataforma (PlatformSettings), não do tenant
  clientSecret: string;
  refreshToken: string;
}

/**
 * Refreshes a delegated access token via the same `/common/token` endpoint,
 * using the refresh token stored for this specific tenant's Microsoft
 * account (not the app-only client-credentials cache above — this is one
 * refresh token per tenant, never shared/cached across tenants). Microsoft
 * may rotate the refresh token on each call; the caller must persist
 * `refreshToken` back if it comes back different, or the connection quietly
 * breaks once the original one expires.
 */
async function refreshDelegatedToken(
  creds: DelegatedGraphCredentials,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
      scope: 'offline_access Mail.Send',
    }),
  });

  if (!response.ok) {
    logger.error(`Falha ao renovar token delegado do Microsoft 365 (${response.status}): ${await response.text()}`);
    return null;
  }

  const json = (await response.json()) as { access_token: string; refresh_token?: string };
  return { accessToken: json.access_token, refreshToken: json.refresh_token ?? creds.refreshToken };
}

/**
 * Sends via Microsoft Graph's delegated `POST /me/sendMail` — the tenant
 * connected their own Microsoft account through Configurações > E-mail >
 * "Conectar com Microsoft" (Authorization Code + offline_access), so this
 * acts as that person, not as an app-only service principal. Returns the
 * (possibly rotated) refresh token alongside success, so the caller can
 * persist it — never store the one that was passed in if a new one came back.
 */
export async function sendViaGraphDelegated(
  creds: DelegatedGraphCredentials,
  params: { to: string[]; subject: string; html: string },
): Promise<{ sent: boolean; refreshToken: string }> {
  try {
    const refreshed = await refreshDelegatedToken(creds);
    if (!refreshed) {
      return { sent: false, refreshToken: creds.refreshToken };
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshed.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: { contentType: 'HTML', content: params.html },
          toRecipients: params.to.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Graph sendMail (delegado) falhou (${response.status}): ${body}`);
    }
    return { sent: true, refreshToken: refreshed.refreshToken };
  } catch (error) {
    logger.error(`Falha ao enviar via Microsoft Graph (delegado): ${(error as Error).message}`);
    return { sent: false, refreshToken: creds.refreshToken };
  }
}

export async function sendViaGraph(creds: GraphCredentials, params: { to: string[]; subject: string; html: string }): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(creds);

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(creds.senderUpn)}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: { contentType: 'HTML', content: params.html },
          toRecipients: params.to.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Graph sendMail falhou (${response.status}): ${body}`);
    }
    return true;
  } catch (error) {
    logger.error(`Falha ao enviar via Microsoft Graph: ${(error as Error).message}`);
    return false;
  }
}
