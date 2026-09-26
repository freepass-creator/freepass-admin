import test from 'node:test';
import assert from 'node:assert/strict';
import { claimAmountOf, marginOf, payAmountOf, settlementRatioOf } from '../money';
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


test('음수나 비정상 정산비율은 금액을 만들지 않고 fail-closed 한다', () => {
  const negative = row({ settleRatio: -0.5 });
  assert.equal(settlementRatioOf(negative), null);
  assert.equal(claimAmountOf(negative), null);
  assert.equal(payAmountOf(negative), null);
  assert.equal(marginOf(negative), null);

  const corrupt = row() as SettlementRow;
  corrupt.settleRatio = Number.NaN;
  assert.equal(settlementRatioOf(corrupt), null);
  assert.equal(claimAmountOf(corrupt), null);
});


test('50% 정산비율은 청구·지급에 동일하게 적용한다', () => {
  const r = row({ settleRatio: 0.5 });
  assert.equal(claimAmountOf(r), 500_000);
  assert.equal(payAmountOf(r), 400_000);
  assert.equal(marginOf(r), 100_000);
});


test('100%를 넘는 정산비율은 손상값으로 fail-closed 한다', () => {
  const over = row({ settleRatio: 1.5 });
  assert.equal(settlementRatioOf(over), null);
  assert.equal(claimAmountOf(over), null);
  assert.equal(payAmountOf(over), null);
  assert.equal(marginOf(over), null);
});


test('일반 청구·지급 최종금액이 음수가 되면 환수로 추측하지 않고 fail-closed 한다', () => {
  const negativeBase = row({ claim: -1, pay: -1 });
  assert.equal(claimAmountOf(negativeBase), null);
  assert.equal(payAmountOf(negativeBase), null);
  assert.equal(marginOf(negativeBase), null);

  const negativeByAdjust = row();
  negativeByAdjust.money.claimAdjust = -1_100_000;
  negativeByAdjust.money.payAdjust = -900_000;
  assert.equal(claimAmountOf(negativeByAdjust), null);
  assert.equal(payAmountOf(negativeByAdjust), null);
  assert.equal(marginOf(negativeByAdjust), null);
});
