import test from 'node:test';
import assert from 'node:assert/strict';
import { claimIsFresh, FINALIZE_CLAIM_TTL, SUBMIT_CLAIM_TTL } from './claim-ttl';

test('esign claim freshness uses the shared 90 second lease', () => {
  const now=1_000_000;
  assert.equal(SUBMIT_CLAIM_TTL,90_000);
  assert.equal(FINALIZE_CLAIM_TTL,90_000);
  assert.equal(claimIsFresh(now-89_999,now,FINALIZE_CLAIM_TTL),true);
  assert.equal(claimIsFresh(now-90_000,now,FINALIZE_CLAIM_TTL),false);
  assert.equal(claimIsFresh(0,now,SUBMIT_CLAIM_TTL),false);
});
