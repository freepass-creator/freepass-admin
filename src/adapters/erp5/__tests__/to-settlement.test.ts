import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feeOf, toSettlementRow } from '../to-settlement.js';
import { blockOf, isOpenIntake, isPerformance, margin } from '../../../domain/settlement/types.js';

/* 값은 ERP5(freepasserp5) settlement_rows 461줄 실측에서 그대로 딴 것이다. */

describe('feeOf — ★한 칸에 비율과 정액이 섞여 있었다', () => {
  it('1 이하는 비율이다', () => {
    assert.deepEqual(feeOf(0.0325, '공급사'), { mode: 'RATE', rate: 0.0325, note: '1 이하라 비율로 읽었다' });
    assert.equal(feeOf(0.025, '영업채널').mode, 'RATE');
  });
  it('★1 을 넘으면 정액이다 — 비율로 읽으면 20조가 나온다', () => {
    const f = feeOf(1_000_000, '공급사');
    assert.equal(f.mode, 'FLAT');
    if (f.mode === 'FLAT') assert.equal(f.amount, 1_000_000);
  });
  it('0 은 「요율 0%」가 아니라 «안 적은 것» 이다', () => {
    assert.equal(feeOf(0, '공급사').mode, 'UNKNOWN');
    assert.equal(feeOf('', '공급사').mode, 'UNKNOWN');
  });
  it('판정한 까닭을 줄에 남긴다', () => {
    assert.match(String(feeOf(1_000_000, '공급사').note), /정액/);
    assert.match(String(feeOf(0, '공급사').note), /모른다/);
  });
});

describe('청구금액 0 을 어떻게 읽나', () => {
  const base = { code: 'stl_x', plate: '175수1279', supplier: '오토플러스', receivedAt: '2026-08-01' };

  it('★끝난 줄의 0 은 «사실» 이다 — 대표 「5월은 이미 다 한거고」', () => {
    const { row, warnings } = toSettlementRow(
      { ...base, claimWritten: 0, payWritten: 800_000, billed: true, payStage: '통보' }, 'd');
    assert.equal(row.money.claim, 0);
    assert.equal(warnings.filter((w) => w.includes('청구금액이 0')).length, 0);
  });
  it('아직 «안 끝난» 줄의 0 은 «모른다» 다', () => {
    const { row, warnings } = toSettlementRow(
      { ...base, claimWritten: 0, payWritten: 800_000, billed: true, payStage: '접수' }, 'd');
    assert.equal(row.money.claim, null);
    assert.ok(warnings.some((w) => w.includes('모른다로 둔다')));
  });
  it('칸 자체가 비면 모른다', () => {
    const { row } = toSettlementRow({ ...base }, 'd');
    assert.equal(row.money.claim, null);
  });
});

describe('★빈칸을 0 으로 만들지 않는다', () => {
  it('차량가액 0 은 «0원짜리 차» 가 아니다 — 신차만 값이 있다', () => {
    const { row } = toSettlementRow({ code: 'c', price: 0 }, 'd');
    assert.equal(row.price, null);
  });
  it('보증금 0 은 무보증 — 사실이므로 그대로 둔다', () => {
    const { row } = toSettlementRow({ code: 'c', deposit: 0 }, 'd');
    assert.equal(row.deposit, 0);
  });
});

describe('열쇠가 없으면 말한다', () => {
  it('차량번호가 없으면 경고한다 — 정산에서 못 붙는다', () => {
    const { warnings } = toSettlementRow({ code: 'c', supplier: '손오공' }, 'd');
    assert.ok(warnings.some((w) => w.includes('차량번호가 없다')));
  });
  it('공급사가 없으면 청구할 곳이 없다', () => {
    const { warnings } = toSettlementRow({ code: 'c', plate: '11가1111' }, 'd');
    assert.ok(warnings.some((w) => w.includes('공급사가 없다')));
  });
  it('정산비율이 1 이 아닌데 까닭이 없으면 말한다', () => {
    const { warnings } = toSettlementRow({ code: 'c', plate: 'p', supplier: 's', settleRatio: 0.5 }, 'd');
    assert.ok(warnings.some((w) => w.includes('까닭이 안 적혀')));
  });
});

describe('실적이냐 접수냐', () => {
  const mk = (o: Record<string, unknown>) =>
    toSettlementRow({ code: 'c', plate: '11가1111', supplier: '손오공', ...o }, 'd').row;

  it('인도가 찍혀야 실적이다', () => {
    assert.equal(isPerformance(mk({ delivered: true })), true);
    assert.equal(isPerformance(mk({ delivered: false })), false);
  });
  it('취소된 것은 실적도 접수도 아니다', () => {
    const r = mk({ delivered: true, cancelled: true });
    assert.equal(isPerformance(r), false);
    assert.equal(isOpenIntake(r), false);
  });
  it('인도 전이면 «아직 접수» 다', () => {
    assert.equal(isOpenIntake(mk({ delivered: false })), true);
  });
});

describe('margin — ★청구를 «모르면» 마진도 모른다', () => {
  const mk = (o: Record<string, unknown>) =>
    toSettlementRow({ code: 'c', plate: 'p', supplier: 's', billed: true, payStage: '통보', ...o }, 'd').row;
  it('셈이 된다', () => {
    assert.equal(margin(mk({ claimWritten: 1_000_000, payWritten: 800_000 })), 200_000);
  });
  it('청구를 모르면 0 이 아니라 null 이다', () => {
    const r = toSettlementRow({ code: 'c', plate: 'p', supplier: 's', payWritten: 800_000 }, 'd').row;
    assert.equal(margin(r), null);
  });
});

describe('blockOf — ★「무엇이 있나」가 아니라 「무엇을 하나」', () => {
  const mk = (o: Record<string, unknown>) =>
    toSettlementRow({ code: 'c', plate: '11가1111', supplier: '손오공', channel: '영업사', ...o }, 'd').row;

  it('계약 → 차량번호 → 상대 정보 순서로 막는다', () => {
    assert.equal(blockOf(toSettlementRow({ code: 'c' }, 'd').row), '계약서');
    assert.equal(blockOf(toSettlementRow({ code: 'c', paper: true }, 'd').row), '차량번호 없음');
    assert.equal(blockOf(toSettlementRow({ code: 'c', paper: true, plate: 'p' }, 'd').row), '공급사 없음');
  });
  it('계약서 → 인도 차례로 막는다', () => {
    assert.equal(blockOf(mk({})), '계약서');
    assert.equal(blockOf(mk({ paper: true })), '인도');
  });
  it('인도된 뒤엔 돈이 막는다', () => {
    assert.equal(blockOf(mk({ paper: true, delivered: true })), '청구금액 모름');
    assert.equal(blockOf(mk({ paper: true, delivered: true, claimWritten: 100, billed: true, payStage: '통보' })), '계산서');
  });
  it('★수금·지급이 마지막 관문이다 — 461줄 중 켜진 것이 0 이다', () => {
    const r = mk({ paper: true, delivered: true, claimWritten: 100, payWritten: 80, channel: '영업사', billed: true, payStage: '통보', invoiceIssued: true });
    assert.equal(blockOf(r), '수금');
    const r2 = mk({ paper: true, delivered: true, claimWritten: 100, payWritten: 80, channel: '영업사', billed: true, payStage: '통보', invoiceIssued: true, collected: true });
    assert.equal(blockOf(r2), '지급');
  });
  it('취소된 줄은 안 막힌다 — 할 일이 없다', () => {
    assert.equal(blockOf(mk({ cancelled: true })), null);
  });
  it('다 끝나면 null', () => {
    const r = mk({ paper: true, delivered: true, claimWritten: 100, billed: true, payStage: '통보', invoiceIssued: true, collected: true, paid: true });
    assert.equal(blockOf(r), null);
  });
});
