import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, normalizeRow, savedSchema, validateRow, intakeFields, followupFields, feeFields } from './model';
test('intake only has employee inputs; fee and follow-up fields are separate', () => {
  assert.equal(intakeFields.length, 14);
  assert.deepEqual(intakeFields.slice(0,6).map(([key]) => key), ['plate','receiptDate','supplier','model','channel','agent']);
  assert.ok(intakeFields.some(([key]) => key === 'vehiclePrice'));
  assert.ok(intakeFields.some(([key]) => key === 'installment'));
  assert.ok(!intakeFields.some(([key]) => ['claim','pay','billingMonth','deliveryDate','supplierRate'].includes(key)));
  assert.deepEqual(followupFields.map(([key]) => key), ['deliveryDate','billingMonth']);
  assert.deepEqual(feeFields.map(([key]) => key), ['claim','pay']);
});
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
test('sheet comma amounts normalize without turning blank into zero', () => {
  const r = normalizeRow({ ...blankRow('r', '2026-10-02'), plate: '테스트', claim: '675,000', pay: '' });
  assert.equal(r.claim, '675000'); assert.equal(r.pay, ''); assert.equal(validateRow(r), null);
});
test('v2 output is readable and missing plate remains corruption', () => {
  assert.equal(savedSchema.parse({ version: 2, rows: [blankRow('r', '2026-10-02')] }).version, 2);
  const r = { ...blankRow('r', '2026-10-02') } as Record<string, unknown>; delete r.plate;
  assert.throws(() => savedSchema.parse({ version: 2, rows: [r] }));
});
