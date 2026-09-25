import assert from 'node:assert/strict';
import test from 'node:test';
import { safeNextPath } from './safe-next';

test('keeps in-site paths with query and hash', () => {
  assert.equal(safeNextPath('/intake/list?q=1#top'), '/intake/list?q=1#top');
  assert.equal(safeNextPath('/settlement'), '/settlement');
});

test('refuses every way out of the site', () => {
  for (const hostile of [
    '/\\evil.com', '/\\/evil.com', '//evil.com', '///evil.com', 'https://evil.com', 'evil.com',
    '/\t/evil.com', '/\n/evil.com', '\\\\evil.com', '', null, undefined,
  ]) {
    assert.equal(safeNextPath(hostile), '/', String(hostile));
  }
});

test('never loops back into the login flow', () => {
  assert.equal(safeNextPath('/login'), '/');
  assert.equal(safeNextPath('/login/google?next=/x'), '/');
});
