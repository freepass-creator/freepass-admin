import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feeOf, type FeeRuleSet } from '../fee.js';
import { F04_EXTRA_ALIASES, F04_EXTRA_RULES } from '../fee-rules-f04-extra.js';

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
