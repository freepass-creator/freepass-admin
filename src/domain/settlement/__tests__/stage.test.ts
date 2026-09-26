import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billingMonth,
  billingMonthIn,
  brokenOf,
  instalmentDueDate,
  lastPaymentDate,
  lockedMonthsOf,
  nextInstallmentDate,
  stageOf,
  ym,
} from '../stage';

const row = (
  deliveredAt: string | null,
  payKind = '2회분납',
  paidRounds: number | null = null,
  extra: Record<string, unknown> = {},
) => ({
  payKind,
  receivedAt: '2026-10-01',
  supplier: '공급사A',
  paidRounds,
  claimStage: '접수' as const,
  payStage: '접수' as const,
  progress: {
    delivered: !!deliveredAt,
    deliveredAt,
    cancelled: false,
    billMonth: null as string | null,
    billed: false,
    invoiceIssued: false,
    collected: false,
    paid: false,
    settleExclude: false,
  },
  ...extra,
});

test('월말 인도의 다음 회차일은 다음 달 말일로 보정한다', () => {
  assert.equal(nextInstallmentDate(row('2026-01-31')), '2026-02-28');
  assert.equal(nextInstallmentDate(row('2028-01-31')), '2028-02-29');
  assert.equal(nextInstallmentDate(row('2026-10-31')), '2026-11-30');
});

test('월말 분납의 마지막 납입월과 청구월이 다음다음 달로 밀리지 않는다', () => {
  const twoRounds = row('2026-10-31');
  assert.equal(ym(lastPaymentDate(twoRounds)!), '2026-11');
  assert.equal(billingMonth(twoRounds, new Date('2026-10-31T12:00:00+09:00')), '2026-11');

  const threeRounds = row('2026-12-31', '3회분납');
  assert.equal(ym(lastPaymentDate(threeRounds)!), '2027-02');
  assert.equal(billingMonth(threeRounds, new Date('2026-12-31T12:00:00+09:00')), '2027-02');
});

test('월말 분납 완료 판정의 한 달 여유도 대상 월 말일을 기준으로 한다', () => {
  const r = row('2026-12-31');
  assert.equal(ym(instalmentDueDate(r)!), '2027-02');
  assert.equal(stageOf(r, new Date('2027-02-28T12:00:00+09:00')), '분납실적');
  assert.equal(stageOf(r, new Date('2027-03-01T00:01:00+09:00')), '완납실적');
});

test('명시 납입회차가 멈춘 월말 분납은 다음 회차 말일 경과 뒤 부러진다', () => {
  const r = row('2026-10-31', '2회분납', 1);
  assert.equal(brokenOf(r, new Date('2026-11-30T23:59:00+09:00')), false);
  assert.equal(brokenOf(r, new Date('2026-12-01T00:01:00+09:00')), true);
});

test('한국 자정 경계에서 서버 UTC와 무관하게 같은 업무일을 쓴다', () => {
  const r = row('2026-08-26', '2회분납', 1);
  // 2026-09-27 00:30 KST = 2026-09-26 15:30 UTC. 9/26 회차일은 이미 지난 날이다.
  assert.equal(brokenOf(r, new Date('2026-09-26T15:30:00Z')), true);
  assert.equal(ym(new Date('2026-09-30T15:30:00Z')), '2026-10');
});

test('인도 전 stale billMonth는 청구월과 실적을 만들지 않는다', () => {
  const r = row(null, '일시납', null, {
    progress: {
      delivered: false,
      deliveredAt: null,
      cancelled: false,
      billMonth: '2026-09',
      billed: false,
      invoiceIssued: false,
      collected: false,
      paid: false,
      settleExclude: false,
    },
  });
  assert.equal(billingMonth(r), null);
  assert.equal(stageOf(r), '접수');
});

test('존재하지 않는 인도일은 계산 엔진에서도 fail-closed 한다', () => {
  const r = row('2026-02-30');
  assert.equal(billingMonth(r), null);
  assert.equal(stageOf(r), '접수');
});

test('명시된 납입회차가 전체 회차면 여유기간 전에도 완납실적이다', () => {
  const r = row('2026-09-10', '2회분납', 2);
  assert.equal(stageOf(r, new Date('2026-09-20T12:00:00+09:00')), '완납실적');
});

test('현재 달 문서 발행과 월마감을 분리하고 explicit CLOSED만 새 계산을 막는다', () => {
  const current = new Date('2026-09-20T12:00:00+09:00');
  const issued = row('2026-09-10', '일시납', null, {
    progress: {
      delivered: true,
      deliveredAt: '2026-09-10',
      cancelled: false,
      billMonth: '2026-09',
      billed: true,
      invoiceIssued: false,
      collected: false,
      paid: false,
      settleExclude: false,
    },
    claimStage: '청구',
  });

  // 거래처 문서가 나간 것만으로 달 전체를 마감했다고 추정하지 않는다.
  assert.equal(lockedMonthsOf([issued], current).has('2026-09'), false);

  const newcomer = row('2026-09-18', '일시납');
  assert.equal(billingMonthIn(newcomer, lockedMonthsOf([issued], current), current), '2026-09');

  // 월마감은 별도 CLOSED 사실이 들어왔을 때만 현재월 자동편입을 막는다.
  const closed = lockedMonthsOf([issued], current, new Set(['2026-09']));
  assert.equal(closed.has('2026-09'), true);
  assert.equal(billingMonthIn(newcomer, closed, current), null);

  // 이미 박힌 기존 행의 billMonth는 CLOSED 뒤에도 그대로 보존된다.
  assert.equal(billingMonthIn(issued, closed, current), '2026-09');
});

test('지난 달의 확정 billMonth는 정산 흔적이 부족한 legacy 행도 다시 흔들지 않는다', () => {
  const current = new Date('2026-09-20T12:00:00+09:00');
  const legacy = row('2026-08-10', '일시납', null, {
    progress: {
      delivered: true,
      deliveredAt: '2026-08-10',
      cancelled: false,
      billMonth: '2026-08',
      billed: false,
      invoiceIssued: false,
      collected: false,
      paid: false,
      settleExclude: false,
    },
  });
  assert.equal(lockedMonthsOf([legacy], current).has('2026-08'), true);
});


test('깨진 소수 납입회차를 반올림해 완납 사실로 만들지 않는다', () => {
  const r = row('2026-09-10', '2회분납', 1.6);
  assert.equal(stageOf(r, new Date('2026-09-20T12:00:00+09:00')), '분납실적');
  assert.equal(nextInstallmentDate(r), '2026-10-10');
});


test('명시 완납은 실적으로는 완료지만 실제 완납일 없이는 청구월을 추정하지 않는다', () => {
  const r = row('2026-09-10', '2회분납', 2);
  assert.equal(stageOf(r, new Date('2026-09-20T12:00:00+09:00')), '완납실적');
  assert.equal(billingMonth(r, new Date('2026-09-20T12:00:00+09:00')), null);

  const dated = { ...r, paidRoundsAt: '2026-09-20' };
  assert.equal(billingMonth(dated, new Date('2026-09-20T12:00:00+09:00')), '2026-09');
});


test('잘못된 legacy billMonth는 확정월로 믿지 않고 fail-closed 한다', () => {
  const r = row('2026-09-10', '일시납', null, {
    progress: {
      delivered: true,
      deliveredAt: '2026-09-10',
      cancelled: false,
      billMonth: '2026-99',
      billed: false,
      invoiceIssued: false,
      collected: false,
      paid: false,
      settleExclude: false,
    },
  });
  assert.equal(billingMonth(r), null);
  assert.equal(lockedMonthsOf([r], new Date('2026-09-20T12:00:00+09:00')).has('2026-99'), false);
});
