import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feeOf, type FeeRuleSet } from '../fee.js';
import { F04_EXTRA_ALIASES, F04_EXTRA_RULES, isMewcar, mewcarBasisFromNote, mewcarGaPayout, mewcarPayoutWarning } from '../fee-rules-f04-extra.js';

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

describe('뮤카 GA 지급 기준금액 — 비교 전용 순수 계산', () => {
  for (const [prepaid, term, expected] of [
    [true, 12, 1_000_000], [true, 24, 1_200_000], [true, 36, 1_200_000], [true, 48, 1_200_000],
    [false, 12, 800_000], [false, 24, 1_000_000], [false, 36, 1_000_000], [false, 48, 1_000_000],
  ] as const) {
    it(`${prepaid ? '선납' : '분납'} ${term}개월 = ${expected}`, () => {
      assert.equal(mewcarGaPayout({ prepaid, term, extraDeposit: 0 }), expected);
    });
  }
  it('추가보증금 10% 가산, 400만원부터 가산 상한 40만원', () => {
    for (const [extraDeposit, expected] of [[1_000_000, 1_100_000], [3_999_990, 1_399_999], [4_000_000, 1_400_000], [9_000_000, 1_400_000]]) {
      assert.equal(mewcarGaPayout({ prepaid: true, term: 12, extraDeposit }), expected);
    }
    assert.equal(mewcarGaPayout({ prepaid: false, term: 12, extraDeposit: 4_000_000 }), 1_200_000);
  });
  it('10% 가산에 원 미만이 생기면 모른다 — 반올림하지 않는다', () => {
    const r = mewcarGaPayout({ prepaid: true, term: 24, extraDeposit: 1_234_567 });
    assert.equal(typeof r, 'object');
    assert.ok(typeof r === 'object' && /원 단위 처리 미확정/.test(r.why));
  });
  it('기간 밖·비정상 입력은 사유 있는 UNKNOWN이며 0이 아니다', () => {
    const valid = { prepaid: true, term: 12, extraDeposit: 0 };
    for (const input of [
      ...[0, -12, 13, 60, 12.5, NaN, Infinity, null, '12'].map((term) => ({ ...valid, term })),
      ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, '0'].map((extraDeposit) => ({ ...valid, extraDeposit })),
      ...[null, undefined, 0, 'false'].map((prepaid) => ({ ...valid, prepaid })),
    ]) {
      const result = mewcarGaPayout(input as Parameters<typeof mewcarGaPayout>[0]);
      assert.ok(typeof result !== 'number' && result.status === 'UNKNOWN' && result.why.length > 0);
    }
  });
});

describe('뮤카 비고 근거 — 명시한 값만 읽는다', () => {
  it('선납/분납과 숫자·콤마·원 단위를 읽는다', () => {
    assert.deepEqual(mewcarBasisFromNote('보증금 선납 · 추가보증금 2,000,000원'), { status: 'KNOWN', prepaid: true, extraDeposit: 2_000_000 });
    assert.deepEqual(mewcarBasisFromNote('분납\n추가보증금 500000 원'), { status: 'KNOWN', prepaid: false, extraDeposit: 500_000 });
  });
  it('없음 또는 명시적 0은 0이다', () => {
    for (const zero of ['없음', '0', '0원', '0 원']) {
      assert.deepEqual(mewcarBasisFromNote(`선납 추가보증금 ${zero}`), { status: 'KNOWN', prepaid: true, extraDeposit: 0 });
    }
  });
  it('빠진 근거를 각각 알린다', () => {
    assert.deepEqual(mewcarBasisFromNote('추가보증금 없음'), { status: 'UNKNOWN', reasons: ['선납/분납 누락'] });
    assert.deepEqual(mewcarBasisFromNote('분납'), { status: 'UNKNOWN', reasons: ['추가보증금 누락'] });
    for (const note of ['', null, undefined]) assert.deepEqual(mewcarBasisFromNote(note), { status: 'UNKNOWN', reasons: ['선납/분납 누락', '추가보증금 누락'] });
  });
  it('모순·잘못된 금액·단위 생략은 부분 숫자로 읽지 않는다', () => {
    for (const note of [
      '선납/분납 추가보증금 없음', '미선납 추가보증금 없음',
      '선납 추가보증금 -1원', '선납 추가보증금 1.5원', '선납 추가보증금 1,00원',
      '선납 추가보증금 100', '선납 추가보증금 0.5원', '선납 추가보증금 0만원',
      '선납 추가보증금 없음아님', '선납 추가보증금 9007199254740992원',
      '선납 추가보증금 없음 / 추가보증금 100원', '선납 추가보증금 0 / 추가보증금 미정',
    ]) assert.equal(mewcarBasisFromNote(note).status, 'UNKNOWN', note);
  });
});

describe('뮤카 지급액 표시 전용 경고', () => {
  const row = { supplier: '뮤카', note: '선납 추가보증금 1,000,000원', term: 12, payWritten: 1_100_000 };
  it('기존 headOf와 별칭을 쓰되 다른 공급사는 포함하지 않는다', () => {
    for (const name of ['뮤카', '무카', '주식회사 뮤카', '㈜ 무카', '무카(주)', '뮤카렌터카']) assert.equal(isMewcar(name), true, name);
    for (const name of ['', null, '무', '뮤카다른회사', '오토플러스']) assert.equal(isMewcar(name), false, String(name));
  });
  it('지급액이 같으면 없음, 다르거나 미확인이면 경고', () => {
    assert.equal(mewcarPayoutWarning(row), null);
    for (const payWritten of [1_000_000, 0, null, NaN]) {
      const warning = mewcarPayoutWarning({ ...row, supplier: '무카', payWritten });
      assert.equal(warning?.label, '뮤카 지급액 확인');
      assert.match(warning?.detail ?? '', /1,100,000원/);
    }
  });
  it('옛 줄의 근거 누락 또는 기간 미확인은 근거 없음, 다른 공급사는 영향 없음', () => {
    assert.equal(mewcarPayoutWarning({ ...row, note: null })?.label, '뮤카 근거 없음');
    for (const term of [null, 60]) assert.equal(mewcarPayoutWarning({ ...row, term })?.label, '뮤카 근거 없음');
    assert.equal(mewcarPayoutWarning({ ...row, supplier: '손오공', note: null, payWritten: 0 }), null);
  });
});

describe('F04 수수료표 추가 줄 — 뮤카 (10-03 확정, 사람이 넣는다)', () => {
  it('뮤카 구독은 기계가 금액을 내지 않는다 — 사람이 정한다(0 아님)', () => {
    const r = feeOf(set, mewcar);
    assert.equal(r.status, 'MANUAL');
    assert.ok(r.status === 'MANUAL' && /기준가×1%/.test(String(r.rule.claim)));
    for (const t of ['선납: 12개월 100만 / 24·36·48개월 120만', '분납: 12개월 80만 / 24·36·48개월 100만', '최대 40만']) {
      assert.ok(r.status === 'MANUAL' && String(r.rule.pay).includes(t), t);
    }
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
