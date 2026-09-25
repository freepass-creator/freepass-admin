import assert from 'node:assert/strict';
import test from 'node:test';
import { safeNextPath, sameOriginRedirect } from './safe-next';

test('login next keeps inner paths with query', () => {
  assert.equal(safeNextPath('/settlement?month=2026-09'), '/settlement?month=2026-09');
  assert.equal(safeNextPath('/intake'), '/intake');
});

test('login next rejects every off-site or login-loop form', () => {
  for (const bad of ['//evil.com', '/\\evil.com', '/\\/evil.com', '/\t/evil.com', '/\n/evil.com', 'https://evil.com', 'evil.com', '', null, undefined, '/login', '/login/google']) {
    assert.equal(safeNextPath(bad), '/', String(bad));
  }
});

test('callback redirect never leaves the request origin', () => {
  const origin = 'https://admin.example.com';
  assert.equal(sameOriginRedirect('/\\evil.com', origin).href, 'https://admin.example.com/');
  assert.equal(sameOriginRedirect('//evil.com', origin).href, 'https://admin.example.com/');
  assert.equal(sameOriginRedirect('/intake?x=1', origin).href, 'https://admin.example.com/intake?x=1');
});
