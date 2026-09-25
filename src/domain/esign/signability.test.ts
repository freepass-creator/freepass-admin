import assert from 'node:assert/strict';
import test from 'node:test';
import { signabilityProblem } from './signability';

const snapshot = { rent: 690000, termMonths: 36, deposit: 0, plate: '12가3456', supplierCode: 'SONO' };
const contract = {
  contract_status: '계약대기', rent_amount_snapshot: 690000, rent_month_snapshot: 36, deposit_amount_snapshot: 0,
  car_number_snapshot: '12가3456', provider_company_code: 'SONO',
};

test('unchanged, live contract is signable', () => {
  assert.equal(signabilityProblem(contract, snapshot), null);
  assert.equal(signabilityProblem(contract, snapshot, { cancelled: false }), null);
});

test('missing, deleted, test, cancelled or withdrawn contracts are not signable', () => {
  assert.match(String(signabilityProblem(null, snapshot)), /찾을 수 없/);
  assert.match(String(signabilityProblem({ ...contract, _deleted: true }, snapshot)), /삭제/);
  assert.match(String(signabilityProblem({ ...contract, is_test: 'true' }, snapshot)), /시험/);
  assert.match(String(signabilityProblem({ ...contract, contract_status: '계약취소' }, snapshot)), /취소/);
  assert.match(String(signabilityProblem({ ...contract, contract_status: '철회' }, snapshot)), /철회/);
});

test('a cancelled source intake blocks signing, including legacy truthy shapes', () => {
  for (const cancelled of [true, 'Y', 1, 'true', '참']) {
    assert.match(String(signabilityProblem(contract, snapshot, { cancelled })), /원본 접수가 취소/);
  }
  assert.equal(signabilityProblem(contract, snapshot, { cancelled: 'N' }), null);
});

test('term drift after issue names every changed field', () => {
  const problem = signabilityProblem(
    { ...contract, rent_amount_snapshot: 700000, deposit_amount_snapshot: 1000000, car_number_snapshot: '34나5678' },
    snapshot,
  );
  assert.match(String(problem), /월 대여료 · 보증금 · 차량번호/);
  assert.match(String(problem), /다시 발행/);
});
