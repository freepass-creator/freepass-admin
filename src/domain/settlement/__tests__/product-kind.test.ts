import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { directIntakeRentKind, ledgerKindOf, resolveLedgerKindSelection } from '../product-kind.js';

describe('상품 상품구분 → 원장 상품구분 (원장 실측에서 읽은 짝)', () => {
  it('중고렌트 → 장기렌트 · 오플구독 → 오플구독 · 구독들 → 구독', () => {
    assert.equal(ledgerKindOf('중고렌트')!.product, '장기렌트');
    assert.equal(ledgerKindOf('오플구독')!.product, '오플구독');
    assert.equal(ledgerKindOf('픽업구독')!.product, '구독');
  });
  it('★상품 리스트의 신차렌트는 전부 선출고로 확정한다', () => {
    const k = ledgerKindOf('신차렌트')!;
    assert.equal(k.certain, true);
    assert.equal(k.product, '선출고');
    assert.equal(k.rentKind, '신차렌트');
    assert.deepEqual(k.choices, ['선출고']);
  });
  it('모르는 말은 짓지 않는다', () => assert.equal(ledgerKindOf('단기렌트'), null));
  it('직접 견적출고·신차발주는 렌트구분을 신차렌트로 고정한다', () => {
    assert.equal(directIntakeRentKind('견적출고'), '신차렌트');
    assert.equal(directIntakeRentKind('신차발주'), '신차렌트');
    assert.equal(directIntakeRentKind('장기렌트'), null);
  });
  it('확정 매핑은 브라우저 값을 무시하고 서버 정본으로 다시 묶는다', () => {
    assert.deepEqual(
      resolveLedgerKindSelection('중고렌트', '신차발주', '신차렌트'),
      { ok: true, product: '장기렌트', rentKind: '재렌트' },
    );
  });
  it('상품 리스트 신차렌트는 브라우저 값과 무관하게 선출고로 다시 묶는다', () => {
    assert.deepEqual(
      resolveLedgerKindSelection('신차렌트', '견적출고', '재렌트'),
      { ok: true, product: '선출고', rentKind: '신차렌트' },
    );
    assert.deepEqual(
      resolveLedgerKindSelection('신차렌트', '신차발주', '신차렌트'),
      { ok: true, product: '선출고', rentKind: '신차렌트' },
    );
  });
});
