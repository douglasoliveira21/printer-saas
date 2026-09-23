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
