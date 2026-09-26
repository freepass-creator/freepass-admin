import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billingMonth,
  brokenOf,
  instalmentDueDate,
  lastPaymentDate,
  nextInstallmentDate,
  stageOf,
  ym,
} from '../stage';

const row = (deliveredAt: string, payKind = '2회분납', paidRounds: number | null = null) => ({
  payKind,
  receivedAt: '2026-10-01',
  supplier: '공급사A',
  paidRounds,
  progress: {
    delivered: true,
    deliveredAt,
    cancelled: false,
    billMonth: null,
  },
});

test('월말 인도의 다음 회차일은 다음 달 말일로 보정한다', () => {
  assert.equal(nextInstallmentDate(row('2026-01-31')), '2026-02-28');
  assert.equal(nextInstallmentDate(row('2028-01-31')), '2028-02-29');
  assert.equal(nextInstallmentDate(row('2026-10-31')), '2026-11-30');
});

test('월말 분납의 마지막 납입월과 청구월이 다음다음 달로 밀리지 않는다', () => {
  const twoRounds = row('2026-10-31');
  assert.equal(ym(lastPaymentDate(twoRounds)!), '2026-11');
  assert.equal(billingMonth(twoRounds, new Date(2026, 9, 31)), '2026-11');

  const threeRounds = row('2026-12-31', '3회분납');
  assert.equal(ym(lastPaymentDate(threeRounds)!), '2027-02');
  assert.equal(billingMonth(threeRounds, new Date(2026, 11, 31)), '2027-02');
});

test('월말 분납 완료 판정의 한 달 여유도 대상 월 말일을 기준으로 한다', () => {
  const r = row('2026-12-31');
  assert.equal(ym(instalmentDueDate(r)!), '2027-02');
  assert.equal(stageOf(r, new Date(2027, 1, 28)), '분납실적');
  assert.equal(stageOf(r, new Date(2027, 2, 1)), '완납실적');
});

test('명시 납입회차가 멈춘 월말 분납은 다음 회차 말일 경과 뒤 부러진다', () => {
  const r = row('2026-10-31', '2회분납', 1);
  assert.equal(brokenOf(r, new Date(2026, 10, 30)), false);
  assert.equal(brokenOf(r, new Date(2026, 11, 1)), true);
});
