import test from 'node:test';
import assert from 'node:assert/strict';
import { contractExitDecision } from './contract-exit';

test('계약접수 상태는 계약취소 가능 — 청구·지급·환수 업무가 생기지 않는다', () => {
  assert.deepEqual(contractExitDecision({
    delivered:false, deliveredAt:'', billed:false, invoiceIssued:false,
    collected:false, paid:false, claimStage:'접수', payStage:'접수', billMonth:'',
  }), { kind:'CANCEL_ALLOWED' });
});

test('인도된 계약은 계약취소가 아니라 계약해지다', () => {
  assert.deepEqual(contractExitDecision({
    delivered:true, deliveredAt:'2026-09-25', claimStage:'접수', payStage:'접수',
  }), { kind:'TERMINATION_REQUIRED', reason:'DELIVERED' });
});

test('인도 전이어도 정산 흔적이 있으면 데이터 이상으로 보고 계약해지 경계로 보낸다', () => {
  for (const raw of [
    { billed:true },
    { billMonth:'2026-09' },
    { collectedAmt:1 },
    { paidAmt:1 },
    { claimStage:'청구' },
    { payStage:'통보' },
  ]) {
    assert.deepEqual(
      contractExitDecision({ delivered:false, deliveredAt:'', claimStage:'접수', payStage:'접수', ...raw }),
      { kind:'TERMINATION_REQUIRED', reason:'SETTLEMENT_STARTED' },
    );
  }
});


test('legacy delivered 참 is treated as delivered and requires termination', () => {
  assert.deepEqual(
    contractExitDecision({delivered:'참',deliveredAt:'2026-09-25',claimStage:'접수',payStage:'접수'}),
    {kind:'TERMINATION_REQUIRED',reason:'DELIVERED'},
  );
});
