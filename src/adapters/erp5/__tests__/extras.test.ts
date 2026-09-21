import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extrasOf, policyStateOf, vehicleClassOf } from '../extras.js';

describe('extras — 원자 글자 그대로, 딴 말은 거른다', () => {
  it('★차급 칸의 딴 말은 비운다', () => {
    assert.equal(vehicleClassOf('준대형 세단'), '준대형 세단');
    assert.equal(vehicleClassOf('중형'), '중형');
    assert.equal(vehicleClassOf('신차렌트'), undefined);
    assert.equal(vehicleClassOf('레이'), undefined);
  });
  it('정책 확정도 — 빈칸은 「확정」 으로 올리지 않는다', () => {
    assert.equal(policyStateOf({ policy_reference_state: 'inferred' }, true), 'INFERRED');
    assert.equal(policyStateOf({ policy_reference_state: 'linked_by_operator' }, true), 'CONFIRMED');
    assert.equal(policyStateOf({}, true), undefined);
    assert.equal(policyStateOf({}, false), 'MISSING');
  });
  it('없는 값은 칸 자체가 없다 · 옵션 미확인 · 링크는 http 만', () => {
    const x = extrasOf({ ext_color: '화이트', option_evidence_status: 'HOLD', source_url: 'javascript:alert(1)', consumer_price: '0' }, true);
    assert.deepEqual(x, { extColor: '화이트', optionsUnverified: true });
  });
});
