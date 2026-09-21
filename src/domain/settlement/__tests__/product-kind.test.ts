import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerKindOf } from '../product-kind.js';
import { feeOf, type FeeRuleSet } from '../fee.js';

describe('상품 상품구분 → 원장 상품구분 (원장 실측에서 읽은 짝)', () => {
  it('중고렌트 → 장기렌트 · 오플구독 → 오플구독 · 구독들 → 구독', () => {
    assert.equal(ledgerKindOf('중고렌트')!.product, '장기렌트');
    assert.equal(ledgerKindOf('오플구독')!.product, '오플구독');
    assert.equal(ledgerKindOf('픽업구독')!.product, '구독');
  });
  it('★신차렌트는 하나로 안 떨어진다 — 기본 선출고 · 사람이 고른다', () => {
    const k = ledgerKindOf('신차렌트')!;
    assert.equal(k.certain, false);
    assert.deepEqual(k.choices, ['선출고', '견적출고', '신차발주']);
  });
  it('모르는 말은 짓지 않는다', () => assert.equal(ledgerKindOf('단기렌트'), null));
  it('★짝이 수수료 갈래를 바꾼다 — 신차렌트 그대로면 재렌트 요율로 샌다', () => {
    const set: FeeRuleSet = {
      version: 't', aliases: {}, evModel: '$^', kindRules: [{ match: '선출고', kind: '신차', form: '선출고' }],
      rules: [
        { id: 'n', supplier: '손오공', kind: '신차', form: '선출고', term: 0, basis: '차량가액', claim: 0.035, pay: 0.03, when: '', auto: true },
        { id: 'r', supplier: '손오공', kind: '재렌트', form: '', term: 60, basis: '대여료×기간', claim: 0.0225, pay: 0.0175, when: '', auto: true },
      ],
    };
    const c = { supplier: '손오공', model: 'G80', term: 60, rent: 900_000, price: 60_000_000 };
    assert.equal(feeOf(set, { ...c, product: '신차렌트' }).status === 'AUTO' && (feeOf(set, { ...c, product: '신차렌트' }) as { rule: { id: string } }).rule.id, 'r');
    assert.equal((feeOf(set, { ...c, product: ledgerKindOf('신차렌트')!.product }) as { rule: { id: string } }).rule.id, 'n');
  });
});
