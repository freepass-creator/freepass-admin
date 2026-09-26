import test from 'node:test';
import assert from 'node:assert/strict';
import { planContractCancellation } from './cancellation';

const contract = (o: Record<string, unknown> = {}) => ({
  contract_status: '계약완료',
  ...o,
});
const intake = (o: Record<string, unknown> = {}) => ({
  cancelled: false,
  delivered: false,
  deliveredAt: '',
  claimStage: '접수',
  payStage: '접수',
  ...o,
});
const input = {
  reason: '고객 변심',
  operationId: 'contractcancel_1234567890',
};
const payment = {
  contractPaymentAmount: 500_000,
  contractPaymentReceivedAt: 1000,
  contractPaymentOperationId: 'contractpay_1234567890abcdef',
  contractPaymentReceiptId: 'bank-1',
};

test('계약금 수납 전은 계약취소가 아니라 접수취소다', () => {
  const result = planContractCancellation(contract(), intake(), input, 2000);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /계약금 수납 전.*접수취소/);
});

test('계약금 수납 후 인도 전이면 계약취소할 수 있다', () => {
  const result = planContractCancellation(contract(), intake(payment), input, 2000);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.idempotent, false);
  assert.equal(result.patch.contract_status, '계약취소');
  assert.equal(result.intakePatch.cancelled, true);
  assert.equal(result.intakePatch.settleExclude, true);
});

test('계약금 수납 기록이 부분적으로만 있으면 fail closed', () => {
  const result = planContractCancellation(contract(), intake({ contractPaymentAmount: 500_000 }), input, 2000);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /계약금 수납 기록이 불완전/);
});

test('인도 후에는 계약취소가 아니라 계약해지다', () => {
  const result = planContractCancellation(contract(), intake({ ...payment, delivered: true, deliveredAt: '2026-09-26' }), input, 2000);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /계약해지/);
});

test('동일 계약취소 operation 재시도는 기존 계약금 기록이 없어도 기존 기록을 보존하며 idempotent다', () => {
  const result = planContractCancellation(
    contract({ contract_status: '계약취소' }),
    intake({
      cancelled: true,
      contractCancelledAt: 100,
      contractCancellationOperationId: input.operationId,
      contractCancellationReason: input.reason,
    }),
    input,
    2000,
  );
  assert.deepEqual(result, { ok: true, idempotent: true, patch: {}, intakePatch: {} });
});

test('정산이 시작된 건은 계약취소하지 않는다', () => {
  const result = planContractCancellation(contract(), intake({ ...payment, billed: true, claimStage: '청구' }), input, 2000);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /정산 흔적/);
});
