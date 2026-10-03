import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, normalizeRow, savedSchema, validateRow, intakeFields, intakeGroups, followupFields, feeFields, plateChoices } from './model';
import type { CanonicalProduct } from '../../../domain/product/types';
test('intake only has employee inputs; fee and follow-up fields are separate', () => {
  assert.equal(intakeFields.length, 14);
  assert.deepEqual(intakeFields.slice(0,6).map(([key]) => key), ['receiptDate','plate','supplier','model','channel','agent']);
  assert.ok(intakeFields.some(([key]) => key === 'vehiclePrice'));
  assert.ok(intakeFields.some(([key]) => key === 'installment'));
  assert.ok(!intakeFields.some(([key]) => ['claim','pay','billingMonth','deliveryDate','supplierRate'].includes(key)));
  assert.deepEqual(followupFields.map(([key]) => key), ['deliveryDate','billingMonth']);
  assert.deepEqual(feeFields.map(([key]) => key), ['claim','pay']);
});
test('three input groups cover all intake fields once; installments follow deposit', () => {
  assert.deepEqual(intakeGroups.map(g=>g.title),['차량 정보','영업 정보','대여 조건 정보']);
  const keys=intakeGroups.flatMap(g=>g.fields.map(([key])=>key));
  assert.equal(new Set(keys).size,14);
  assert.deepEqual([...keys].sort(),intakeFields.map(([key])=>key).sort());
  assert.deepEqual(intakeGroups[2].fields.slice(-2).map(([key])=>key),['deposit','installment']);
});
test('plate lookup keeps each offer together and unknown deposit separate from zero', () => {
  const product = {id:'p',version:1,sourceSnapshotId:'s',registration:{vehicleNumber:'123하4567'},supplierName:'A',vehicle:{modelId:'차종'},productKind:'중고렌트',offers:[{id:'a',supplierName:'B',termMonths:36,monthlyRent:500000,deposit:0},{id:'b',termMonths:48,monthlyRent:450000}]} as CanonicalProduct;
  const choices = plateChoices([product], '123 하-4567');
  assert.deepEqual(choices.map(c=>[c.term,c.rent,c.deposit,c.supplier]),[['36','500000','0','B'],['48','450000','','A']]);
  assert.equal(new Set(choices.map(c=>c.key)).size,2);
  assert.equal(plateChoices([product],'다른차번').length,0);
  assert.equal(plateChoices([product],'').length,0);
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
