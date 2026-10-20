import assert from 'node:assert/strict';
import test from 'node:test';
import { creditConsentPreviewEnabled, isCreditConsentPreviewPath, esignEnabled, isEsignRuntimePath } from './esign-scope';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

test('draft preview requires an explicit non-production environment', () => {
  for (const env of [{}, { NODE_ENV: 'production' }, { VERCEL_ENV: 'production', NODE_ENV: 'development' }]) {
    assert.equal(creditConsentPreviewEnabled(env), false);
  }
  assert.equal(creditConsentPreviewEnabled({ VERCEL_ENV: 'preview', NODE_ENV: 'production' }), true);
  assert.equal(creditConsentPreviewEnabled({ NODE_ENV: 'development' }), true);
  for (const path of ['/preview/credit-consent/x', '/api/esign/public/t', '/sign/t', '/esign']) {
    assert.equal(isCreditConsentPreviewPath(path), false);
  }
});

test('preview proxy permits read-only draft, closes production and keeps real signing closed', async () => {
  const before = { VERCEL_ENV: process.env.VERCEL_ENV, ESIGN_ENABLED: process.env.ESIGN_ENABLED };
  try {
    process.env.VERCEL_ENV = 'preview';
    process.env.ESIGN_ENABLED = 'off';
    const request = (path: string, method = 'GET') => new NextRequest('https://example.test' + path, { method });
    assert.equal((await proxy(request('/preview/credit-consent'))).headers.get('Cache-Control'), 'no-store');
    assert.equal((await proxy(request('/preview/credit-consent', 'POST'))).status, 405);
    assert.equal((await proxy(request('/sign/example'))).status, 404);
    assert.equal((await proxy(request('/api/esign/public/example', 'POST'))).status, 404);
    process.env.VERCEL_ENV = 'production';
    assert.equal((await proxy(request('/preview/credit-consent'))).status, 404);
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('esign stays closed unless ESIGN_ENABLED=on', () => {
  const before = process.env.ESIGN_ENABLED;
  try {
    delete process.env.ESIGN_ENABLED;
    assert.equal(esignEnabled(), false);
    process.env.ESIGN_ENABLED = 'off';
    assert.equal(esignEnabled(), false);
    process.env.ESIGN_ENABLED = 'on';
    assert.equal(esignEnabled(), true);
  } finally {
    if (before === undefined) delete process.env.ESIGN_ENABLED; else process.env.ESIGN_ENABLED = before;
  }
});

test('esign runtime gate covers customer links and write APIs but not the admin page', () => {
  for (const p of ['/sign/abc', '/api/esign/public/t', '/api/esign/admin/c1/approve', '/api/esign/final/s1', '/api/intake/I-1/contract']) {
    assert.equal(isEsignRuntimePath(p), true, p);
  }
  for (const p of ['/esign', '/esign/detail', '/intake', '/intake/list', '/settlement', '/products', '/c/token', '/signin', '/esignature', '/api/contracts/c1/terminate']) {
    assert.equal(isEsignRuntimePath(p), false, p);
  }
});
