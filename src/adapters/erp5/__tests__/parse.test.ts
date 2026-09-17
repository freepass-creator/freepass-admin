import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAge, parseMileageKm, parseMoney, parsePriceKey, parseRate, parseYesNo } from '../parse.js';
import { offersOf, policyValuesOf, toCanonicalProduct } from '../to-canonical.js';

/* 값은 전부 ERP5(freepasserp5) 실측에서 그대로 딴 것이다. 지어낸 것이 없다. */

describe('parseMoney — ERP5 가 쓰는 돈 표기', () => {
  it('만 단위를 읽는다', () => {
    assert.equal(parseMoney('2만원'), 20_000);
    assert.equal(parseMoney('10만원'), 100_000);
    assert.equal(parseMoney('월 5만원'), undefined);   /* ★앞에 말이 붙으면 «안» 읽는다 — 추측하지 않는다 */
    assert.equal(parseMoney('100만원'), 1_000_000);
  });
  it('억·천만 단위를 읽는다', () => {
    assert.equal(parseMoney('1억원'), 100_000_000);
    assert.equal(parseMoney('2억원'), 200_000_000);
    assert.equal(parseMoney('1천5백만원'), 15_000_000);
  });
  it('원 단위와 숫자를 읽는다', () => {
    assert.equal(parseMoney('200원'), 200);
    assert.equal(parseMoney('1,720,000'), 1_720_000);
    assert.equal(parseMoney(2_500_000), 2_500_000);
  });
  it('★못 읽으면 0 이 아니라 undefined 다', () => {
    assert.equal(parseMoney('무한'), undefined);
    assert.equal(parseMoney('차량가액'), undefined);
    assert.equal(parseMoney(''), undefined);
    assert.equal(parseMoney(null), undefined);
  });
});

describe('parseMileageKm', () => {
  it('실측 표기를 읽는다', () => {
    assert.equal(parseMileageKm('연 30,000km'), 30_000);
    assert.equal(parseMileageKm('연 20,000km'), 20_000);
    assert.equal(parseMileageKm('2만'), 20_000);
    assert.equal(parseMileageKm('3만km'), 30_000);
  });
  it('못 읽으면 undefined', () => {
    assert.equal(parseMileageKm('무제한'), undefined);
    assert.equal(parseMileageKm(''), undefined);
  });
});

describe('parseAge — ★「불가」와 「제한없음」과 나이는 서로 다른 사실이다', () => {
  it('나이를 읽는다', () => {
    assert.deepEqual(parseAge('만 26세 이상'), { age: 26 });
    assert.deepEqual(parseAge('만 21세 이상'), { age: 21 });
    assert.deepEqual(parseAge('만21세'), { age: 21 });
    assert.deepEqual(parseAge('만 70세 이하'), { age: 70 });
  });
  it('「불가」를 나이 0 으로 읽지 않는다', () => {
    assert.deepEqual(parseAge('불가'), { denied: true });
  });
  it('「제한없음」을 나이 0 으로 읽지 않는다', () => {
    assert.deepEqual(parseAge('제한없음'), { unlimited: true });
  });
});

describe('parseRate', () => {
  it('퍼센트와 소수를 같은 값으로 읽는다', () => {
    assert.equal(parseRate('30%'), 0.3);
    assert.equal(parseRate(0.3), 0.3);
    assert.equal(parseRate('20%'), 0.2);
    assert.equal(parseRate(0.12), 0.12);
  });
});

describe('parseYesNo — ★「협의」는 거짓이 아니다', () => {
  it('가능·불가를 읽는다', () => {
    assert.equal(parseYesNo('가능'), true);
    assert.equal(parseYesNo('불가'), false);
    assert.equal(parseYesNo('포함'), true);
    assert.equal(parseYesNo('불포함'), false);
  });
  it('「협의」는 모른다로 둔다', () => {
    assert.equal(parseYesNo('협의'), undefined);
  });
});

describe('parsePriceKey — ERP5 price 맵의 열쇠', () => {
  it('기간만 있는 꼴', () => {
    assert.deepEqual(parsePriceKey('12'), { termMonths: 12, annualMileageKm: undefined });
    assert.deepEqual(parsePriceKey('24'), { termMonths: 24, annualMileageKm: undefined });
  });
  it('기간_주행거리 꼴', () => {
    assert.deepEqual(parsePriceKey('12_2만'), { termMonths: 12, annualMileageKm: 20_000 });
    assert.deepEqual(parsePriceKey('12_3만'), { termMonths: 12, annualMileageKm: 30_000 });
  });
  it('★주행거리가 없으면 «무제한» 이 아니라 undefined 다', () => {
    assert.equal(parsePriceKey('36').annualMileageKm, undefined);
  });
});

describe('offersOf — price 중첩맵을 Offer 로', () => {
  it('실측 맵을 편다', () => {
    const { offers, warnings } = offersOf(
      { '12': { deposit: 2_500_000, rent: 1_720_000 }, '24': { deposit: 2_500_000, rent: 1_450_000 } },
      'P-1',
    );
    assert.equal(offers.length, 2);
    assert.equal(warnings.length, 0);
    assert.equal(offers[0].termMonths, 12);
    assert.equal(offers[0].monthlyRent, 1_720_000);
    assert.equal(offers[0].deposit, 2_500_000);
    assert.equal(offers[1].termMonths, 24);
  });
  it('★보증금 0 은 «무보증» 이고, 없는 것은 undefined 다', () => {
    const { offers } = offersOf({ '12_2만': { rent: 770_000, deposit: 0 }, '12_3만': { rent: 800_000 } }, 'P-2');
    assert.equal(offers[0].deposit, 0);            /* 무보증 — 사실이다 */
    assert.equal(offers[1].deposit, undefined);    /* 모른다 — 0 이 아니다 */
  });
  it('대여료가 없는 칸은 버리되 «까닭을 남긴다»', () => {
    const { offers, warnings } = offersOf({ '12': { deposit: 100 } }, 'P-3');
    assert.equal(offers.length, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /대여료가 없다/);
  });
  it('기간 짧은 것부터 선다', () => {
    const { offers } = offersOf({ '36': { rent: 1 }, '12': { rent: 2 }, '24': { rent: 3 } }, 'P-4');
    assert.deepEqual(offers.map((o) => o.termMonths), [12, 24, 36]);
  });
});

describe('policyValuesOf — ★못 읽은 칸을 버리지 않는다', () => {
  const pv = policyValuesOf({
    basic_driver_age: '만 26세 이상',
    driver_age_lowering: '불가',
    annual_mileage: '연 30,000km',
    mileage_upcharge_per_10000km: '2만원',
    early_termination_rate_under1y: '30%',
    deposit_card_payment: '불가',
    deposit_installment: '협의',
    injury_compensation_limit: '무한',
    _key: '버려야 한다',
    companyId: '버려야 한다',
  });
  const by = (id: string) => pv.find((p) => p.policyId === id);

  it('나이를 숫자로 읽는다', () => {
    assert.deepEqual(by('basic_driver_age'), { policyId: 'basic_driver_age', type: 'NUMBER', value: 26 });
  });
  it('「불가」는 숫자가 아니라 글자로 남는다', () => {
    assert.deepEqual(by('driver_age_lowering'), { policyId: 'driver_age_lowering', type: 'TEXT', value: '불가' });
  });
  it('주행거리·돈·비율을 읽는다', () => {
    assert.equal(by('annual_mileage')?.value, 30_000);
    assert.equal(by('mileage_upcharge_per_10000km')?.value, 20_000);
    assert.equal(by('early_termination_rate_under1y')?.value, 0.3);
  });
  it('「협의」는 참·거짓이 아니라 글자로 남는다', () => {
    assert.equal(by('deposit_card_payment')?.type, 'BOOLEAN');
    assert.equal(by('deposit_installment')?.type, 'TEXT');
  });
  it('★못 읽은 「무한」도 버리지 않고 원문으로 남긴다', () => {
    assert.deepEqual(by('injury_compensation_limit'),
      { policyId: 'injury_compensation_limit', type: 'TEXT', value: '무한' });
  });
  it('기록용 칸은 안 싣는다', () => {
    assert.equal(by('_key'), undefined);
    assert.equal(by('companyId'), undefined);
  });
});

describe('toCanonicalProduct — ★버린 까닭을 반드시 돌려준다', () => {
  const base = {
    car_number: '02하9092', provider_company_code: 'RP006', maker: '기아', model: 'EV6',
    sub_model: 'EV6', trim_name: '어스', year: 2022, price: { '36': { rent: 1_090_000, deposit: 0 } },
  };
  it('멀쩡한 줄을 옮긴다', () => {
    const r = toCanonicalProduct(base, 'doc1', undefined, 'snap-1');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.product.supplierId, 'RP006');
    assert.equal(r.product.supplierProductKey, '02하9092');
    assert.equal(r.product.offers.length, 1);
    assert.equal(r.product.vehicle.matchLevel, 'TRIM');
  });
  it('listable=false 는 «까닭과 함께» 뺀다', () => {
    const r = toCanonicalProduct({ ...base, listable: false }, 'doc1', undefined, 's');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, 'NOT_LISTABLE');
    assert.equal(r.key, '02하9092');
  });
  it('차량번호가 없으면 열쇠가 없다', () => {
    const r = toCanonicalProduct({ ...base, car_number: '' }, 'doc1', undefined, 's');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'NO_CAR_NUMBER');
  });
  it('값이 없는 상품은 못 고른다', () => {
    const r = toCanonicalProduct({ ...base, price: undefined }, 'doc1', undefined, 's');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'NO_PRICE');
  });
  it('★차종마스터 미등록을 조용히 넘기지 않는다', () => {
    const r = toCanonicalProduct(
      { ...base, ssot_status: 'HOLD', ssot_hold_reasons: ['IDENT:세부모델 「EV6」이 차종마스터에 없다'] },
      'doc1', undefined, 's',
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.product.vehicle.matchLevel, 'UNMATCHED');
    assert.ok(r.warnings.some((w) => w.includes('차종마스터 미등록')));
  });
  it('정책이 안 붙은 것도 «말해» 준다', () => {
    const r = toCanonicalProduct(base, 'doc1', undefined, 's');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(r.warnings.some((w) => w.includes('정책이 안 붙어')));
  });
});
