type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

const S = (value: unknown) => String(value ?? '').trim();

export function freepassDataOrigin(env: Record<string, string | undefined> = process.env) {
  const raw = S(env.FREEPASS_DATA_BASE_URL).replace(/\/+$/, '');
  if (!raw) throw new Error('FREEPASS_DATA_BASE_URL is required');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('FREEPASS_DATA_BASE_URL_INVALID'); }
  if (
    !['https:', 'http:'].includes(url.protocol)
    || url.username
    || url.password
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search
    || url.hash
  ) {
    throw new Error('FREEPASS_DATA_BASE_URL_MUST_BE_ORIGIN');
  }
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('FREEPASS_DATA_BASE_URL_MUST_BE_HTTPS');
  }
  return url.origin;
}

export async function freepassDataCloudRunHeaders(
  base = freepassDataOrigin(),
  env: Record<string, string | undefined> = process.env,
  oidcTokenSupplier: () => Promise<string> = getVercelOidcToken,
): Promise<Record<string, string>> {
  const staticToken = S(env.FREEPASS_DATA_CLOUD_RUN_ID_TOKEN);
  if (staticToken) return { 'x-serverless-authorization': 'Bearer ' + staticToken };

  const wifAudience = S(env.FREEPASS_DATA_GCP_WIF_AUDIENCE);
  const callerServiceAccount = S(env.FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL);
  if (!wifAudience && !callerServiceAccount && !S(env.VERCEL_OIDC_TOKEN)) return {};
  if (!wifAudience || !callerServiceAccount) throw new Error('FREEPASS_DATA_GCP_OIDC_CONFIG_INCOMPLETE');

  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) {
    return { 'x-serverless-authorization': 'Bearer ' + cached.token };
  }

  // Vercel Functions supply a fresh token in request context; process.env alone can be empty/stale.
  const vercelOidc = S(await oidcTokenSupplier());
  if (!vercelOidc) throw new Error('FREEPASS_DATA_GCP_OIDC_TOKEN_MISSING');

  const sts = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      audience: wifAudience,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      subject_token: vercelOidc,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!sts.ok) throw new Error('FREEPASS_DATA_GCP_STS_HTTP_' + sts.status);
  const stsBody = await sts.json() as { access_token?: unknown; expires_in?: unknown };
  const accessToken = S(stsBody.access_token);
  if (!accessToken) throw new Error('FREEPASS_DATA_GCP_STS_TOKEN_MISSING');

  const idResponse = await fetch(
    'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'
      + encodeURIComponent(callerServiceAccount)
      + ':generateIdToken',
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + accessToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ audience: base, includeEmail: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!idResponse.ok) throw new Error('FREEPASS_DATA_GCP_ID_TOKEN_HTTP_' + idResponse.status);
  const idBody = await idResponse.json() as { token?: unknown };
  const token = S(idBody.token);
  if (!token) throw new Error('FREEPASS_DATA_GCP_ID_TOKEN_MISSING');

  const ttlSeconds = Number(stsBody.expires_in);
  const ttlMs = Number.isFinite(ttlSeconds) && ttlSeconds > 0
    ? Math.min(ttlSeconds * 1000, 45 * 60 * 1000)
    : 45 * 60 * 1000;
  cached = { token, expiresAt: now + ttlMs };
  return { 'x-serverless-authorization': 'Bearer ' + token };
}

export function resetFreepassDataCloudRunTokenForTest() {
  cached = null;
}
import { getVercelOidcToken } from '@vercel/oidc';
