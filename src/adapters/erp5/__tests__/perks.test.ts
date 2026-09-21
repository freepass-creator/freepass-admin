import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { creditOf, perksOf, productKindOf } from '../perks.js';

describe('상품구분 캐논 (erp4 와 같음)', () => {
  it('옛 말을 캐논으로 접는다', () => {
    assert.equal(productKindOf('재렌트'), '중고렌트');
    assert.equal(productKindOf('손오공 구독'), '오공구독');
    assert.equal(productKindOf('신차 구독'), '신차구독');
  });
  it('시트 오류 글자는 비운다 · 없으면 빈 글자', () => {
    assert.equal(productKindOf('#REF!'), '');
    assert.equal(productKindOf(undefined), '');
  });
});

describe('심사 — ★모르면 「무심사」 로 꾸미지 않는다', () => {
  it('정책 글자를 세 말로 읽는다', () => {
    assert.equal(creditOf({}, { screening_criteria: '저신용 가능' }), '무심사');
    assert.equal(creditOf({}, { screening_criteria: '신용조회 필요' }), '신용조회');
    assert.equal(creditOf({}, { screening_criteria: '소득 증빙' }), '소득확인');
  });
  it('없으면 미입력', () => assert.equal(creditOf({}, {}), '미입력'));
});

describe('혜택 줄 — 차례가 뜻이다(심사 맨 앞)', () => {
  it('다 붙는 차', () => assert.deepEqual(
    perksOf({ accident_history: '무 사고' }, {
      screening_criteria: '무심사', deposit_installment: '2회', basic_driver_age: '만 26세', driver_age_lowering: '21', license_period: '제한없음',
    }, [0, 0]),
    ['무심사', '분납가능', '무보증', '만21세', '경력무관', '무사고']));
  it('★보증금이 한 기간이라도 모르면 무보증이 아니다', () =>
    assert.ok(!perksOf({}, {}, [0, undefined]).includes('무보증')));
  it('분납 「불가」 · 경력 「1년 이상」 · 26세는 안 붙는다', () =>
    assert.deepEqual(perksOf({}, { deposit_installment: '불가', license_period: '1년 이상', basic_driver_age: '26' }, [1_000_000]), []));
  it('심사를 모르면 줄에 안 세운다', () => assert.deepEqual(perksOf({}, undefined, []), []));
});
