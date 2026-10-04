import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feeOf, type FeeRuleSet } from '../fee.js';
import { F04_EXTRA_ALIASES, F04_EXTRA_RULES, isMewcar, mewcarBasisFromNote, mewcarGaPayout, mewcarPayoutWarning, type MewcarGaTable } from '../fee-rules-f04-extra.js';

const W = '보증금·대여료 회차 완납';
const set: FeeRuleSet = {
  version: 'test',
  aliases: { ...F04_EXTRA_ALIASES },
  evModel: '\\bEV\\d?\\b|아이오닉\\s*[56]',
  kindRules: [{ match: '구독', kind: '구독', evKind: '전기차', evFallback: '구독' }],
  rules: [
    { id: 'base', supplier: '오토플러스', kind: '구독', form: '', term: 0, basis: '정액', claim: 1_000_000, pay: 800_000, when: W, auto: true },
    ...F04_EXTRA_RULES.map((r, i) => ({ id: `extra-${i}`, ...r })),
  ],
};
const mewcar = { supplier: '뮤카', product: '구독', model: '쏘렌토', term: 36, rent: 700_000, price: 40_000_000 };

/* ★가짜 표 — 실제 금액은 프리패스 데이터 수수료 규칙에만 있다(공개 코드에 두지 않는다) */
const T: MewcarGaTable = { prepaid: { 12: 111_000, 24: 222_000 }, installment: { 12: 77_000, 24: 99_000 }, extraRate: 0.05, extraCap: 30_000 };
describe('뮤카 GA 지급 기준금액 — 비교 전용 순수 계산(표는 밖에서 받는다)', () => {
  it('표가 없으면 계산하지 않고 모른다', () => {
    const r = mewcarGaPayout({ prepaid: true, term: 12, extraDeposit: 0 }, null);
    assert.ok(typeof r !== 'number' && /프리패스 데이터에 뮤카 수수료 규칙이 아직 없음/.test(r.why));
  });
  for (const [prepaid, term, expected] of [[true, 12, 111_000], [true, 24, 222_000], [false, 12, 77_000], [false, 24, 99_000]] as const) {
    it(`${prepaid ? '선납' : '분납'} ${term}개월 = 표 값`, () => assert.equal(mewcarGaPayout({ prepaid, term, extraDeposit: 0 }, T), expected));
  }
  it('추가보증금 가산은 요율·상한을 표에서 받는다', () => {
    assert.equal(mewcarGaPayout({ prepaid: true, term: 12, extraDeposit: 200_000 }, T), 121_000);
    assert.equal(mewcarGaPayout({ prepaid: true, term: 12, extraDeposit: 9_000_000 }, T), 141_000);
  });
  it('가산에 원 미만이 생기면 모른다 — 반올림하지 않는다', () => {
    const r = mewcarGaPayout({ prepaid: true, term: 24, extraDeposit: 1_234_567 }, T);
    assert.ok(typeof r !== 'number' && /원 단위 처리 미확정/.test(r.why));
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
describe('뮤카 지급액 표시 전용 경고', () => {
  const row = { supplier: '뮤카', note: '선납 추가보증금 200,000원', term: 12, payWritten: 121_000 };
  it('기존 headOf와 별칭을 쓰되 다른 공급사는 포함하지 않는다', () => {
    for (const name of ['뮤카', '무카', '주식회사 뮤카', '㈜ 무카', '무카(주)', '뮤카렌터카']) assert.equal(isMewcar(name), true, name);
    for (const name of ['', null, '무', '뮤카다른회사', '오토플러스']) assert.equal(isMewcar(name), false, String(name));
  });
  it('규칙이 없으면 대조하지 않고 «금액 모름»만 표시', () => {
    assert.equal(mewcarPayoutWarning(row)?.label, '뮤카 금액 모름');
    assert.equal(mewcarPayoutWarning(row, null)?.label, '뮤카 금액 모름');
  });
  it('규칙이 있으면: 지급액이 같으면 없음, 다르거나 미확인이면 경고', () => {
    assert.equal(mewcarPayoutWarning(row, T), null);
    for (const payWritten of [111_000, 0, null, NaN]) {
      const warning = mewcarPayoutWarning({ ...row, supplier: '무카', payWritten }, T);
      assert.equal(warning?.label, '뮤카 지급액 확인');
      assert.match(warning?.detail ?? '', /121,000원/);
    }
  });
  it('옛 줄의 근거 누락 또는 표에 없는 기간은 근거 없음, 다른 공급사는 영향 없음', () => {
    assert.equal(mewcarPayoutWarning({ ...row, note: null }, T)?.label, '뮤카 근거 없음');
    for (const term of [null, 60]) assert.equal(mewcarPayoutWarning({ ...row, term }, T)?.label, '뮤카 근거 없음');
    assert.equal(mewcarPayoutWarning({ ...row, supplier: '손오공', note: null, payWritten: 0 }, T), null);
  });
});

describe('F04 수수료표 추가 줄 — 뮤카 (10-03 확정, 사람이 넣는다)', () => {
  it('뮤카 구독은 기계가 금액을 내지 않는다 — 사람이 정한다(0 아님)', () => {
    const r = feeOf(set, mewcar);
    assert.equal(r.status, 'MANUAL');
    assert.ok(r.status === 'MANUAL' && /프리패스 데이터 수수료 규칙/.test(String(r.rule.claim)) && /프리패스 데이터 수수료 규칙/.test(String(r.rule.pay)));
    /* 공개 코드에 금액을 두지 않는다 — 규칙 글에 숫자가 없어야 한다 */
    for (const r2 of F04_EXTRA_RULES) for (const t of [r2.claim, r2.pay, r2.note ?? '']) assert.doesNotMatch(String(t), /\d/, String(t));
    assert.ok(r.status === 'MANUAL' && r.rule.when === '보증금 분납 완납 전 미지급');
  });
  it('기간·전기차 모델과 무관하게 같은 규칙 — 다른 공급사 규칙으로 새지 않는다', () => {
    for (const c of [{ ...mewcar, term: 12 }, { ...mewcar, term: 48 }, { ...mewcar, model: 'EV6' }]) {
      const r = feeOf(set, c);
      assert.equal(r.status, 'MANUAL');
      assert.ok(r.status === 'MANUAL' && r.rule.supplier === '뮤카');
    }
  });
  it('「무카」로 적어도 뮤카 규칙을 찾는다', () => {
    const r = feeOf(set, { ...mewcar, supplier: '무카' });
    assert.ok(r.status === 'MANUAL' && r.rule.supplier === '뮤카');
  });
  it('추가보증금 입력이 없어 자동으로 세지 않는다 — auto=false', () => {
    for (const r of F04_EXTRA_RULES) assert.equal(r.auto, false);
  });
});
