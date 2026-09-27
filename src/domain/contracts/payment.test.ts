import test from 'node:test';
import assert from 'node:assert/strict';
import { contractPaymentDispositionStateOf, contractPaymentStateOf, planContractPayment, planContractPaymentDisposition } from './payment';

const input = {
  amount: 500_000,
  operationId: 'contractpay_1234567890abcdef',
  receiptId: 'bank-20260926-001',
};

test('계약금 수납은 금액·시각·operation을 별도 사실로 기록한다', () => {
  const result = planContractPayment({}, input, 1000);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.idempotent, false);
  assert.equal(result.patch.contractPaymentAmount, 500_000);
  assert.equal(result.patch.contractPaymentReceivedAt, 1000);
  assert.equal(result.patch.contractPaymentOperationId, input.operationId);
  assert.equal(result.patch.contractPaymentReceiptId, input.receiptId);
});

test('같은 operation과 payload 재시도는 idempotent다', () => {
  const raw = {
    contractPaymentAmount: 500_000,
    contractPaymentReceivedAt: 1000,
    contractPaymentOperationId: input.operationId,
    contractPaymentReceiptId: input.receiptId,
    contractPaymentBy: '관리자',
  };
  const result = planContractPayment(raw, input, 2000);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.idempotent, true);
  assert.deepEqual(result.patch, {});
});

test('같은 operation이라도 금액이 다르면 조용히 성공하지 않는다', () => {
  const raw = {
    contractPaymentAmount: 500_000,
    contractPaymentReceivedAt: 1000,
    contractPaymentOperationId: input.operationId,
    contractPaymentReceiptId: input.receiptId,
  };
  const result = planContractPayment(raw, { ...input, amount: 600_000 }, 2000);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /이미 다른 계약금/);
});

test('부분 기록은 계약금 미수납으로 추측하지 않고 INCONSISTENT로 막는다', () => {
  const state = contractPaymentStateOf({ contractPaymentAmount: 500_000 });
  assert.equal(state.state, 'INCONSISTENT');
});

test('0원·소수·잘못된 operation id는 받지 않는다', () => {
  assert.equal(planContractPayment({}, { ...input, amount: 0 }, 1000).ok, false);
  assert.equal(planContractPayment({}, { ...input, amount: 1.5 }, 1000).ok, false);
  assert.equal(planContractPayment({}, { ...input, operationId: 'short' }, 1000).ok, false);
});

test('취소/해지 뒤에는 새 계약금 수납을 기록하지 않는다', () => {
  assert.equal(planContractPayment({ cancelled: true }, input, 1000).ok, false);
  assert.equal(planContractPayment({ contractCancelledAt: 1 }, input, 1000).ok, false);
  assert.equal(planContractPayment({ contractTerminatedAt: 1 }, input, 1000).ok, false);
});

test('계약취소 후 계약금은 반환·공급사 귀속·상계 합계로 명시적으로 종결한다', () => {
  const raw = {
    cancelled: true,
    contractCancelledAt: 2000,
    contractPaymentAmount: 500_000,
    contractPaymentReceivedAt: 1000,
    contractPaymentOperationId: 'contractpay_1234567890abcdef',
  };
  assert.equal(contractPaymentDispositionStateOf(raw).state, 'PENDING');
  const result = planContractPaymentDisposition(raw, {
    refundedAmount: 100_000,
    supplierRevenueAmount: 300_000,
    offsetAmount: 100_000,
    reason: '취소 약정에 따른 일부 반환 및 비용 상계',
    operationId: 'depositdisposition_1234567890',
  }, 3000);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const state = contractPaymentDispositionStateOf({ ...raw, ...result.patch });
  assert.equal(state.state, 'RESOLVED');
  if (state.state === 'RESOLVED') assert.equal(state.fact.supplierRevenueAmount, 300_000);
});

test('계약금 처리 합계 불일치와 인도 후 취소처리를 막는다', () => {
  const raw = {
    cancelled: true,
    contractCancelledAt: 2000,
    contractPaymentAmount: 500_000,
    contractPaymentReceivedAt: 1000,
    contractPaymentOperationId: 'contractpay_1234567890abcdef',
  };
  const input = {
    refundedAmount: 100_000,
    supplierRevenueAmount: 100_000,
    offsetAmount: 0,
    reason: '처리',
    operationId: 'depositdisposition_1234567890',
  };
  assert.equal(planContractPaymentDisposition(raw, input, 3000).ok, false);
  assert.equal(planContractPaymentDisposition({ ...raw, delivered: true }, { ...input, supplierRevenueAmount: 400_000 }, 3000).ok, false);
});
