import test from 'node:test';
import assert from 'node:assert/strict';
import { claimAmountOf, marginOf, payAmountOf } from '../money';
import type { SettlementRow } from '../types';

const row = (o: {
  claim?: number | null;
  pay?: number | null;
  settleRatio?: number;
} = {}) => ({
  payKind: '일시납',
  paidRounds: null,
  supplier: '공급사A',
  settleRatio: o.settleRatio ?? 1,
  progress: {
    billHold: false,
    delivered: true,
    deliveredAt: '2026-09-10',
    cancelled: false,
    billMonth: '2026-09',
  },
  money: {
    claim: o.claim === undefined ? 1_000_000 : o.claim,
    pay: o.pay === undefined ? 800_000 : o.pay,
    claimIncentive: 0,
    payIncentive: 0,
    claimAdjust: 0,
    payAdjust: 0,
  },
}) as SettlementRow;

test('정산비율 0은 100%로 되살아나지 않는다', () => {
  const r = row({ settleRatio: 0 });
  assert.equal(claimAmountOf(r), 0);
  assert.equal(payAmountOf(r), 0);
  assert.equal(marginOf(r), 0);
});

test('청구 또는 지급 금액을 모르면 남는 것도 모른다', () => {
  assert.equal(marginOf(row({ claim: null, pay: 800_000 })), null);
  assert.equal(marginOf(row({ claim: 1_000_000, pay: null })), null);
});

test('양쪽 금액을 알 때만 남는 금액을 계산한다', () => {
  assert.equal(marginOf(row()), 200_000);
});
