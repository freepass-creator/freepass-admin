import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factPatch, progressPatch, settlementStartedOf } from '../intake';

const base = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  receivedAt: '2026-10-01', plate: 'PLATE-EXAMPLE', customer: '고객A', model: '쏘렌토', supplier: '예시공급사A', supplierCode: 'S1',
  channel: '프리패스', channelCode: 'C1', agent: '김영업', agentCode: 'A1', product: '장기렌트', term: 36, rent: 500000,
  deposit: null, price: null, payKind: '일시납', note: '', delivered: false, cancelled: false,
  claimStage: '접수', payStage: '접수', claimWritten: 675000, payWritten: 540000, ...over,
});

test('changes only what differs and logs sheet column names', () => {
  const r = factPatch(base(), { customer: '고객A', model: '쏘렌토 MQ4', rent: '520,000', deposit: '' });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.patch, { model: '쏘렌토 MQ4', rent: 520000 });
  assert.deepEqual(r.events, [
    { field: '모델명', from: '쏘렌토', to: '쏘렌토 MQ4' },
    { field: '렌탈료', from: '500000', to: '520000' },
  ]);
});

test('never touches fee amounts or the receipt date', () => {
  const r = factPatch(base(), { receivedAt: '2026-10-02', claimWritten: 1 } as never);
  assert.deepEqual(r, { ok: true, patch: {}, events: [] });
});

test('required names cannot be blanked and pay kind is a fixed vocabulary', () => {
  assert.equal(factPatch(base(), { customer: '  ' }).ok, false);
  assert.equal(factPatch(base(), { agent: '' }).ok, false);
  assert.equal(factPatch(base(), { payKind: '4회분납' }).ok, false);
  assert.equal(factPatch(base(), { rent: '-1' }).ok, false);
  assert.equal(factPatch(base(), { term: 'abc' }).ok, false);
});

test('cancelled or terminated rows are locked', () => {
  assert.equal(factPatch(base({ cancelled: true }), { model: 'x' }).ok, false);
  assert.equal(factPatch(base({ contractTerminatedAt: 1 }), { model: 'x' }).ok, false);
});

test('terms lock after delivery or settlement, names stay editable before documents', () => {
  assert.equal(factPatch(base({ delivered: true }), { term: 48 }).ok, false);
  assert.equal(factPatch(base({ billMonth: '2026-10' }), { payKind: '2회분납' }).ok, false);
  assert.equal(factPatch(base({ delivered: true }), { customer: '홍길순' }).ok, true);
});

test('supplier locks with the claim axis, channel/agent with the pay axis', () => {
  assert.equal(factPatch(base({ billed: true }), { supplier: '예시공급사C' }).ok, false);
  assert.equal(factPatch(base({ claimStage: '청구' }), { agent: '박영업' }).ok, true);
});

test('pay axis lock is independent from the claim axis', () => {
  assert.equal(factPatch(base({ claimStage: '청구' }), { agent: '박영업', agentCode: '' }).ok, true);
  assert.equal(factPatch(base({ payStage: '통보' }), { agent: '박영업' }).ok, false);
  assert.equal(factPatch(base({ payStage: '통보' }), { supplier: '예시공급사C' }).ok, true);
});

test('documents issued lock customer/model/memo', () => {
  assert.equal(factPatch(base({ billed: true }), { customer: '홍길순' }).ok, false);
  assert.equal(factPatch(base({ payStage: '통보' }), { note: '메모' }).ok, false);
});

test('catalog-sealed intakes cannot change offer-bound terms', () => {
  const sealed = base({ catalogSnapshotDigest: 'abc' });
  assert.equal(factPatch(sealed, { rent: 1 }).ok, false);
  assert.equal(factPatch(sealed, { supplier: '예시공급사C' }).ok, false);
  assert.equal(factPatch(sealed, { customer: '홍길순' }).ok, true);
});

test('a party code cannot change without its name (Codex review)', () => {
  assert.equal(factPatch(base(), { supplierCode: 'S2' }).ok, false);
  assert.equal(factPatch(base(), { channelCode: 'C2' }).ok, false);
  assert.equal(factPatch(base(), { agentCode: 'A2' }).ok, false);
  assert.equal(factPatch(base(), { supplierCode: 'S1' }).ok, true, 'same code is no change');
  const r = factPatch(base(), { supplier: '예시공급사C', supplierCode: '' });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.patch, { supplier: '예시공급사C', supplierCode: '' });
});

test('money already moved or dated documents lock like checks do (Codex review)', () => {
  assert.equal(factPatch(base({ collectedAmt: 1000 }), { supplier: '예시공급사C' }).ok, false);
  assert.equal(factPatch(base({ collectedAmt: 1000 }), { term: 48 }).ok, false);
  assert.equal(factPatch(base({ paidAmt: 1000 }), { agent: '박영업' }).ok, false);
  assert.equal(factPatch(base({ invoiceAt: '2026-10-05' }), { customer: '홍길순' }).ok, false);
  assert.equal(factPatch(base({ billedAt: '2026-10-05' }), { supplier: '예시공급사C' }).ok, false);
  assert.equal(factPatch(base({ paidAt: '2026-10-05' }), { channel: '다른채널' }).ok, false);
  assert.equal(settlementStartedOf(base({ paidAmt: 1 })), true);
  assert.equal(settlementStartedOf(base({ collectedAmt: 0, paidAmt: 0 })), false);
});

test('settlementStartedOf is shared with progressPatch', () => {
  assert.equal(settlementStartedOf(base()), false);
  assert.equal(settlementStartedOf(base({ invoiceNoS: 'S-1' })), true);
  assert.equal(progressPatch(base({ invoiceNoS: 'S-1' }), { kind: 'plate', plate: 'PLATE-CHANGED' }).ok, false);
  assert.equal(progressPatch(base(), { kind: 'plate', plate: 'PLATE-CHANGED' }).ok, true);
});
