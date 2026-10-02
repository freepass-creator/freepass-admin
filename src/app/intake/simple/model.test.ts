import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, savedSchema, validateRow } from './model';
test('same plate stays separate by stable row id; blank money is not zero', () => {
  const a = { ...blankRow('a', '2026-10-02'), plate: '테스트차량' };
  const b = { ...a, id: 'b' };
  const saved = savedSchema.parse({ version: 1, rows: [a, b] });
  assert.equal(saved.rows.length, 2); assert.equal(a.claim, ''); assert.equal(validateRow(a), null);
});
test('invalid saved data is rejected rather than silently replaced', () => {
  assert.throws(() => savedSchema.parse({ version: 1, rows: [{}] }));
});
test('old draft gains optional sheet inputs without losing existing values', () => {
  const row = blankRow('old', '2026-10-02');
  const old = { ...row, plate: '테스트', claim: '675000' } as Record<string, unknown>;
  delete old.refundReason; delete old.contractNumber; delete old.refunded;
  const migrated = savedSchema.parse({ version: 1, rows: [old] }).rows[0];
  assert.equal(migrated.claim, '675000'); assert.equal(migrated.refundReason, ''); assert.equal(migrated.refunded, false);
});
test('amount validation permits negative refunds but not malformed amounts', () => {
  const a = { ...blankRow('a', '2026-10-02'), plate: '테스트', claim: '-100000' };
  assert.equal(validateRow(a), null);
  assert.match(validateRow({ ...a, pay: 'oops' })!, /지급액/);
});
