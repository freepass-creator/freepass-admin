import assert from 'node:assert/strict';
import test from 'node:test';
import { AccessError } from './errors';
import { validateSessionExchange } from './session-policy';

const base = {
  requestUrl: 'https://admin.freepasserp.com/api/auth/session',
  origin: 'https://admin.freepasserp.com',
  csrfCookie: 'same-csrf-token',
  csrfBody: 'same-csrf-token',
  authTimeSeconds: 1_000,
  nowSeconds: 1_100,
};

test('session exchange accepts same-origin, matching CSRF and recent sign-in', () => {
  assert.doesNotThrow(() => validateSessionExchange(base));
});

test('session exchange rejects missing or foreign origin', () => {
  for (const origin of [null, 'https://attacker.example']) {
    assert.throws(() => validateSessionExchange({ ...base, origin }), AccessError);
  }
});

test('session exchange rejects missing or mismatched CSRF', () => {
  for (const csrfBody of [undefined, 'forged']) {
    assert.throws(() => validateSessionExchange({ ...base, csrfBody }), AccessError);
  }
});

test('session exchange rejects stale or future auth_time', () => {
  assert.throws(() => validateSessionExchange({ ...base, authTimeSeconds: 700 }), AccessError);
  assert.throws(() => validateSessionExchange({ ...base, authTimeSeconds: 1_101 }), AccessError);
});
