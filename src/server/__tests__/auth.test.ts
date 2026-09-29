import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath, looksLikeSession } from '../auth.js';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/session/route';
import { IdentityPoolClient } from 'google-auth-library';
import { identityAccountFromFederation, identityFederatedCredential, identityFederationConfig, identityReady, IDENTITY_SERVICE_ACCOUNT, IDENTITY_WIF_AUDIENCE } from '../identity';

const federation = {
  IDENTITY_GCP_WIF_AUDIENCE: IDENTITY_WIF_AUDIENCE,
  IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL: IDENTITY_SERVICE_ACCOUNT,
  IDENTITY_FIREBASE_PROJECT_ID: 'freepasserp5',
  VERCEL_ENV: 'production',
};

it('identity federation accepts only the dedicated production trust and never falls back on partial settings', () => {
  assert.equal(identityFederationConfig({}), null);
  assert.equal(identityFederationConfig(federation)?.email, IDENTITY_SERVICE_ACCOUNT);
  for (const change of [
    { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' },
    { IDENTITY_FIREBASE_PROJECT_ID: 'other' }, { IDENTITY_GCP_WIF_AUDIENCE: 'https://attacker.test' },
    { IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL: 'business-writer@freepasserp5.iam.gserviceaccount.com' },
    { IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL: '' }, { IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON: '{}' },
  ]) assert.throws(() => identityFederationConfig({ ...federation, ...change }), /CONFIG_INVALID/);
});

it('federated authority reads one encoded document; missing, denied, malformed and expired credentials fail closed', async (t) => {
  const keys = [...Object.keys(federation), 'IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, federation);
  delete process.env.IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON;
  let tokenCalls = 0;
  let expired = false;
  t.mock.method(IdentityPoolClient.prototype, 'getAccessToken', async function(this: IdentityPoolClient) {
    tokenCalls++;
    this.credentials.expiry_date = Date.now() + (expired ? -1000 : 120_000);
    return { token: 'test-only-short-token' };
  });
  let response = new Response(JSON.stringify({ fields: {
    status: { stringValue: 'APPROVED' }, role: { stringValue: 'MASTER' }, name: { stringValue: 'Test' },
  } }));
  const reads: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    reads.push(url);
    assert.equal(init.method, undefined, 'only default GET is permitted');
    assert.equal((init.headers as Record<string, string>).authorization, 'Bearer test-only-short-token');
    assert.equal(init.cache, 'no-store');
    return response;
  });
  try {
    assert.deepEqual(await identityAccountFromFederation('test/../user@example.test'), { status: 'APPROVED', role: 'MASTER', name: 'Test' });
    assert.equal(reads[0], 'https://firestore.googleapis.com/v1/projects/freepasserp5/databases/(default)/documents/identity_accounts/test%2F..%2Fuser%40example.test');
    response = new Response('', { status: 404 });
    assert.equal(await identityAccountFromFederation('missing@example.test'), null);
    response = new Response('private upstream diagnostic', { status: 403 });
    await assert.rejects(identityAccountFromFederation('denied@example.test'), /^Error: IDENTITY_ACCOUNT_HTTP_403$/);
    response = new Response(JSON.stringify({ fields: { status: { booleanValue: true }, role: { stringValue: 'MASTER' } } }));
    assert.equal((await identityAccountFromFederation('malformed@example.test'))?.status, undefined);
    expired = true;
    await assert.rejects(identityFederatedCredential.getAccessToken(), /IDENTITY_ACCESS_TOKEN_UNAVAILABLE/);
    assert.equal(reads.length, 4, 'expired credential must not be sent to Firestore');
    assert.equal(tokenCalls, 5);
    process.env.IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL = 'other';
    assert.equal(identityReady(), false);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

it('missing server identity configuration returns 503 without a session or secrets', async () => {
  const key = 'IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON';
  const previous = process.env[key];
  delete process.env[key];
  try {
    const response = await POST(new NextRequest('https://admin.example.test/api/session', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'untrusted-test-token' }),
    }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(await response.json(), { error: 'IDENTITY_NOT_CONFIGURED' });
  } finally {
    if (previous === undefined) delete process.env[key]; else process.env[key] = previous;
  }
});

describe('로그인 없이 열리는 길', () => {
  it('청구 링크 · 고객 전자계약 · 사진 · 글꼴 · 로그인은 공개한다', () => {
    for (const p of [
      '/c/abc',
      '/sign/token-123',
      '/api/esign/public/token-123',
      '/api/esign/public/token-123/asset',
      '/api/img',
      '/login',
      /* 공용 로그인 화면이 Firebase 로 사람을 확인한 뒤 토큰을 맡기는 곳 — 그때는 아직 쿠키가 없다 */
      '/api/session',
      '/fonts/pretendard/pretendard.css',
      '/fonts/pretendard/woff2-dynamic-subset/PretendardVariable.subset.0.woff2',
      '/fonts/OFL-Pretendard.txt',
      '/_next/static/x.js',
      '/favicon.ico',
    ]) assert.ok(isPublicPath(p), p);

    for (const p of [
      '/',
      '/intake',
      '/settlement',
      '/products',
      '/esign',
      '/api/esign/asset/session/id_card',
      '/api/esign/document/session',
      '/c',
      '/login2',
      '/api/other',
      '/design',
    ]) assert.ok(!isPublicPath(p), p);
  });
});

describe('proxy 의 쿠키 눈대중 — 이것만으로는 아무도 못 들어온다', () => {
  /**
   * ★proxy 는 모든 요청 앞에서 도는 자리라 firebase-admin 을 싣지 않는다. 쿠키 «꼴»만 본다.
   *   진짜 검증(서명 · 취소 · 승인 · grant)은 require-admin.ts → identity.ts 가 쪽과 서버 액션 앞에서 한다.
   */
  it('Firebase 세션 쿠키 꼴이 아니면 문 앞에서 걷는다', () => {
    for (const bad of [undefined, '', 'abc', 'a.b', 'a.b.c', `g1.${'x'.repeat(40)}`, 'x'.repeat(200)]) {
      assert.equal(looksLikeSession(bad), false, String(bad));
    }
  });

  it('꼴이 맞으면 지나가되, 지나간 것이 권한은 아니다', () => {
    assert.ok(looksLikeSession(['eyJhbGciOiJSUzI1NiJ9', 'x'.repeat(40), 'c2ln'].join('.')));
  });
});
