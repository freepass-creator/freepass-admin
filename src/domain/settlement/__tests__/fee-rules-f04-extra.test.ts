import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { F04_EXTRA_ALIASES, F04_EXTRA_RULES, isMewcar, mewcarBasisFromNote, mewcarGaPayout, mewcarPayoutWarning, type MewcarGaTable } from '../fee-rules-f04-extra.js';

/* ★가짜 표 — 실제 금액은 프리패스 데이터 수수료 규칙에만 있다(공개 코드에 두지 않는다) */
const T: MewcarGaTable = { prepaid: { 12: 111_000, 24: 222_000 }, installment: { 12: 77_000, 24: 99_000 }, extraRate: 0.05, extraCap: 30_000 };
describe('예시공급사D GA 지급 기준금액 — 비교 전용 순수 계산(표는 밖에서 받는다)', () => {
  it('표가 없으면 계산하지 않고 모른다', () => {
    const r = mewcarGaPayout({ prepaid: true, term: 12, extraDeposit: 0 }, null);
    assert.ok(typeof r !== 'number' && /프리패스 데이터에 예시공급사D 수수료 규칙이 아직 없음/.test(r.why));
  });
  for (const [prepaid, term, expected] of [[true, 12, 111_000], [true, 24, 222_000], [false, 12, 77_000], [false, 24, 99_000]] as const) {
    it(`${prepaid ? '선납' : '분납'} ${term}개월 = 표 값`, () => assert.equal(mewcarGaPayout({ prepaid, term, extraDeposit: 0 }, T), expected));
  }
  it('추가보증금 가산은 요율·상한을 표에서 받는다', () => {
    assert.equal(mewcarGaPayout({ prepaid: true, term: 12, extraDeposit: 200_000 }, T), 121_000);
    assert.equal(mewcarGaPayout({ prepaid: true, term: 12, extraDeposit: 9_000_000 }, T), 141_000);
  });
  it('가산은 원 미만을 버리고 상한을 적용한다', () => {
    const r = mewcarGaPayout({ prepaid: true, term: 24, extraDeposit: 1_234_567 }, T);
    assert.equal(r, 252_000);
  });
  it('상한 미만의 소수 가산은 버린다', () => {
    const synthetic = { prepaid: { 1: 7 }, installment: { 1: 3 }, extraRate: 0.19, extraCap: 9 };
    assert.equal(mewcarGaPayout({ prepaid: true, term: 1, extraDeposit: 9 }, synthetic), 8);
  });
  it('표에 없는 기간·비정상 입력은 사유 있는 UNKNOWN이며 0이 아니다', () => {
    const valid = { prepaid: true, term: 12, extraDeposit: 0 };
    for (const input of [
      ...[0, -12, 13, 60, 12.5, NaN, Infinity, null, '12'].map((term) => ({ ...valid, term })),
      ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, '0'].map((extraDeposit) => ({ ...valid, extraDeposit })),
      ...[null, undefined, 0, 'false'].map((prepaid) => ({ ...valid, prepaid })),
    ]) {
      const result = mewcarGaPayout(input as Parameters<typeof mewcarGaPayout>[0], T);
      assert.ok(typeof result !== 'number' && result.status === 'UNKNOWN' && result.why.length > 0);
    }
  });
});
describe('예시공급사D 지급액 표시 전용 경고', () => {
  const row = { supplier: '예시공급사D', note: '선납 추가보증금 200,000원', term: 12, payWritten: 121_000 };
  it('기존 headOf와 별칭을 쓰되 다른 공급사는 포함하지 않는다', () => {
    for (const name of ['예시공급사D', '예시공급사D', '주식회사 예시공급사D', '㈜ 예시공급사D', '예시공급사D(주)', '예시공급사D렌터카']) assert.equal(isMewcar(name), true, name);
    for (const name of ['', null, '무', '예시공급사D다른회사', '예시공급사B']) assert.equal(isMewcar(name), false, String(name));
  });
  it('규칙이 없으면 대조하지 않고 «금액 모름»만 표시', () => {
    assert.equal(mewcarPayoutWarning(row)?.label, '예시공급사D 금액 모름');
    assert.equal(mewcarPayoutWarning(row, null)?.label, '예시공급사D 금액 모름');
  });
  it('규칙이 있으면: 지급액이 같으면 없음, 다르거나 미확인이면 경고', () => {
    assert.equal(mewcarPayoutWarning(row, T), null);
    for (const payWritten of [111_000, 0, null, NaN]) {
      const warning = mewcarPayoutWarning({ ...row, supplier: '예시공급사D', payWritten }, T);
      assert.equal(warning?.label, '예시공급사D 지급액 확인');
      assert.match(warning?.detail ?? '', /121,000원/);
    }
  });
  it('옛 줄의 근거 누락 또는 표에 없는 기간은 근거 없음, 다른 공급사는 영향 없음', () => {
    assert.equal(mewcarPayoutWarning({ ...row, note: null }, T)?.label, '예시공급사D 근거 없음');
    for (const term of [null, 60]) assert.equal(mewcarPayoutWarning({ ...row, term }, T)?.label, '예시공급사D 근거 없음');
    assert.equal(mewcarPayoutWarning({ ...row, supplier: '예시공급사A', note: null, payWritten: 0 }, T), null);
  });
});

describe('GA 설명 메타데이터', () => {
  it('요율 계산 경로 없이 설명과 비자동 표만 보존한다', () => {
    for (const rule of F04_EXTRA_RULES) {
      assert.equal(rule.auto, false);
      for (const value of [rule.claim, rule.pay, rule.note ?? '']) assert.doesNotMatch(String(value), /\d/);
    }
  });
});
