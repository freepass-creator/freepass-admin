import assert from 'node:assert/strict';
import test from 'node:test';
import { FixtureAdminDataAdapter } from './fixture-admin-data';

const adapter = new FixtureAdminDataAdapter();

test('returns the versioned Admin read model through one port', async () => {
  const result = await adapter.readDashboard({ role: 'ADMIN', search: '', sort: 'MATCH', limit: 2 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.contract, 'freepass-data.admin-read-model/v1');
  assert.equal(result.data.products.length, 2);
  assert.equal(result.data.page.hasNext, true);
  assert.match(result.data.page.nextCursor ?? '', /^data-r20260921-0130:/);
});

test('preserves unknown conflict partial hold and stale semantics', async () => {
  const result = await adapter.readDashboard({ role: 'ADMIN', search: '', sort: 'MATCH', limit: 10 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const sonata = result.data.products.find((product) => product.canonicalProductId === 'cp-sonata-002');
  const k5 = result.data.products.find((product) => product.canonicalProductId === 'cp-k5-003');
  const gv80 = result.data.products.find((product) => product.canonicalProductId === 'cp-gv80-004');
  assert.equal(sonata?.offers[0]?.deposit.state, 'UNKNOWN');
  assert.equal(sonata?.offers[0]?.deposit.value, undefined);
  assert.equal(sonata?.vehicleMatch, 'PARTIAL');
  assert.equal(k5?.offers[0]?.monthlyRent.state, 'CONFLICT');
  assert.equal(k5?.hold, 'HOLD');
  assert.equal(gv80?.freshness, 'STALE');
});

test('returns authoritative matched offers and interpreted conditions', async () => {
  const result = await adapter.readDashboard({ role: 'ADMIN', search: '무보증 카드', sort: 'MATCH', limit: 10 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.appliedQuery.interpretedConditions, ['보증금 0원', '카드결제']);
  assert.deepEqual(result.data.products.map((product) => product.canonicalProductId), ['cp-santafe-mx5-001', 'cp-k5-003']);
  assert.deepEqual(result.data.products[0]?.matchedOfferIds, ['of-santafe-36']);
});

test('binds cursors to query and revision', async () => {
  const first = await adapter.readDashboard({ role: 'ADMIN', search: '', sort: 'MATCH', limit: 2 });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const invalid = await adapter.readDashboard({ role: 'ADMIN', search: 'K5', sort: 'MATCH', limit: 2, cursor: first.data.page.nextCursor });
  assert.deepEqual(invalid, { ok: false, code: 'CURSOR_INVALID', message: '조회 조건 또는 dataset revision이 바뀌어 cursor를 다시 사용할 수 없습니다.', retryable: false });
});

test('applies explicit role redaction and audit permission', async () => {
  const operator = await adapter.readDashboard({ role: 'OPERATOR', search: '', sort: 'MATCH', limit: 1 });
  assert.equal(operator.ok, true);
  if (!operator.ok) return;
  assert.equal(operator.data.permissions.canViewAudit, false);
  assert.equal(operator.data.audit.length, 0);
  assert.equal(operator.data.products[0]?.offers[0]?.monthlyRent.provenance.sourceRecordRef, undefined);

  const auditor = await adapter.readDashboard({ role: 'AUDITOR', search: '', sort: 'MATCH', limit: 1 });
  assert.equal(auditor.ok, true);
  if (!auditor.ok) return;
  assert.equal(auditor.data.products[0]?.supplier.state, 'REDACTED');
});

test('exposes stale and typed upstream error scenarios', async () => {
  const stale = await adapter.readDashboard({ role: 'ADMIN', search: '', sort: 'MATCH', limit: 2, scenario: 'STALE' });
  assert.equal(stale.ok, true);
  if (stale.ok) assert.equal(stale.data.freshness, 'STALE');

  const error = await adapter.readDashboard({ role: 'ADMIN', search: '', sort: 'MATCH', limit: 2, scenario: 'ERROR' });
  assert.deepEqual(error, { ok: false, code: 'UPSTREAM_UNAVAILABLE', message: 'Freepass Data fixture upstream unavailable.', retryable: true });
});
