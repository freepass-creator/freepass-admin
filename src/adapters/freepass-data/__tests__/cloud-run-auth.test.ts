import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freepassDataCloudRunHeaders,
  freepassDataOrigin,
  resetFreepassDataCloudRunTokenForTest,
} from '../cloud-run-auth';

test('FreePass Data origin requires a clean HTTPS origin in production', () => {
  assert.equal(
    freepassDataOrigin({ NODE_ENV: 'production', FREEPASS_DATA_BASE_URL: 'https://data.example.test/' }),
    'https://data.example.test',
  );
  assert.throws(
    () => freepassDataOrigin({ NODE_ENV: 'production', FREEPASS_DATA_BASE_URL: 'http://data.example.test' }),
    /MUST_BE_HTTPS/,
  );
  assert.throws(
    () => freepassDataOrigin({ FREEPASS_DATA_BASE_URL: 'https://data.example.test/path' }),
    /MUST_BE_ORIGIN/,
  );
});

test('static Cloud Run ID token is accepted only as the serverless authorization header', async () => {
  resetFreepassDataCloudRunTokenForTest();
  const headers = await freepassDataCloudRunHeaders('https://data.example.test', {
    FREEPASS_DATA_CLOUD_RUN_ID_TOKEN: 'diagnostic-token',
  });
  assert.deepEqual(headers, { 'x-serverless-authorization': 'Bearer diagnostic-token' });
});

test('partial Vercel OIDC configuration fails closed', async () => {
  resetFreepassDataCloudRunTokenForTest();
  await assert.rejects(
    () => freepassDataCloudRunHeaders('https://data.example.test', {
      VERCEL_OIDC_TOKEN: 'vercel-token',
      FREEPASS_DATA_GCP_WIF_AUDIENCE: '//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/pool/providers/provider',
    }),
    /OIDC_CONFIG_INCOMPLETE/,
  );
});

test('Vercel OIDC exchanges through Google STS and IAM Credentials for a Cloud Run ID token', async () => {
  resetFreepassDataCloudRunTokenForTest();
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === 'https://sts.googleapis.com/v1/token') {
      return new Response(JSON.stringify({ access_token: 'sts-access', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes(':generateIdToken')) {
      assert.equal((init?.headers as Record<string,string>)?.authorization, 'Bearer sts-access');
      assert.deepEqual(JSON.parse(String(init?.body)), {
        audience: 'https://data.example.test',
        includeEmail: true,
      });
      return new Response(JSON.stringify({ token: 'cloud-run-id-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error('unexpected fetch ' + url);
  }) as typeof fetch;

  try {
    const headers = await freepassDataCloudRunHeaders('https://data.example.test', {
      VERCEL_OIDC_TOKEN: 'vercel-token',
      FREEPASS_DATA_GCP_WIF_AUDIENCE: '//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/pool/providers/provider',
      FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL: 'caller@example.iam.gserviceaccount.com',
    });
    assert.deepEqual(headers, { 'x-serverless-authorization': 'Bearer cloud-run-id-token' });
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.url, 'https://sts.googleapis.com/v1/token');
    assert.match(calls[1]?.url ?? '', /caller%40example\.iam\.gserviceaccount\.com:generateIdToken$/);
  } finally {
    globalThis.fetch = originalFetch;
    resetFreepassDataCloudRunTokenForTest();
  }
});
