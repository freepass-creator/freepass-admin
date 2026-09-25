import assert from 'node:assert/strict';
import test from 'node:test';
import { esignEnabled, isEsignPath } from './esign-scope';

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

test('esign paths cover admin list, customer link, esign API and intake-to-contract only', () => {
  for (const p of ['/esign', '/sign/abc', '/api/esign/public/t', '/api/esign/admin/c1/approve', '/api/esign/final/s1', '/api/intake/I-1/contract']) {
    assert.equal(isEsignPath(p), true, p);
  }
  for (const p of ['/intake', '/intake/list', '/settlement', '/products', '/c/token', '/signin', '/esignature', '/api/contracts/c1/terminate']) {
    assert.equal(isEsignPath(p), false, p);
  }
});
