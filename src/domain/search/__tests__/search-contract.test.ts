import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matchProduct } from '../match-product';
import { searchProducts } from '../search-products';
import { offer, policy, product, vehicle } from './fixtures';

/**
 * 회귀테스트 — 규칙 번호는 `docs/contracts/SEARCH-CONTRACT.md` 를 가리킨다.
 * 기능을 통과시키려고 이 테스트를 느슨하게 고치지 않는다 (AGENTS.md §10).
 */

describe('S-01 같은 축은 OR · 다른 축은 AND', () => {
  it('한 축에 여러 값을 주면 그중 하나만 맞아도 된다', () => {
    const p = product({ offers: [offer({ id: 'o-24', termMonths: 24 })] });
    assert.ok(matchProduct(p, { termMonths: [12, 24, 36] }));
  });

  it('서로 다른 축은 모두 맞아야 한다', () => {
    const p = product({ offers: [offer({ id: 'o-24', termMonths: 24, monthlyRent: 900_000 })] });
    assert.equal(matchProduct(p, { termMonths: [24], monthlyRent: { max: 700_000 } }), null);
  });
});

describe('S-02 같은 Offer 하나가 다 만족해야 한다', () => {
  const twoOffers = product({
    offers: [
      offer({ id: 'cheap', termMonths: 36, monthlyRent: 600_000, deposit: 3_000_000 }),
      offer({ id: 'no-deposit', termMonths: 36, monthlyRent: 900_000, deposit: 0 }),
    ],
  });

  it('싼 대여료와 다른 Offer 의 무보증을 합쳐 없는 조건을 만들지 않는다', () => {
    assert.equal(
      matchProduct(twoOffers, { monthlyRent: { max: 700_000 }, deposit: { max: 0 } }),
      null,
    );
  });

  it('한 Offer 가 두 조건을 다 만족하면 그 Offer 만 걸린다', () => {
    const match = matchProduct(twoOffers, { monthlyRent: { max: 950_000 }, deposit: { max: 0 } });
    assert.deepEqual(match?.matchedOfferIds, ['no-deposit']);
  });
});

describe('S-03 일치한 Offer 는 끝까지 따라간다', () => {
  it('조건에 맞은 Offer 만 id 로 실린다', () => {
    const p = product({
      offers: [
        offer({ id: 'o-12', termMonths: 12, monthlyRent: 800_000 }),
        offer({ id: 'o-36', termMonths: 36, monthlyRent: 690_000 }),
        offer({ id: 'o-48', termMonths: 48, monthlyRent: 650_000 }),
      ],
    });
    const match = matchProduct(p, { termMonths: [36, 48] });
    assert.deepEqual(match?.matchedOfferIds, ['o-36', 'o-48']);
    assert.deepEqual(
      match?.matchedOffers.map((o) => o.id),
      match?.matchedOfferIds,
    );
  });
});

describe('S-04 확정된 깊이까지만 믿는다', () => {
  it('matchLevel 이 MODEL 이면 데이터에 남은 세부모델 id 는 쓰지 않는다', () => {
    const p = product({
      vehicle: vehicle({ matchLevel: 'MODEL', subModelId: 'sub-leftover' }),
    });
    const match = matchProduct(p, { subModelIds: ['sub-other'] });
    assert.equal(match?.vehicleMatch.level, 'PARTIAL');
    assert.deepEqual(match?.vehicleMatch.unconfirmedAxes, ['SUB_MODEL']);
  });
});

describe('S-05 확정값이 다르면 제외한다', () => {
  it('다른 세부모델로 확정된 상품은 PARTIAL 에 섞이지 않는다', () => {
    const p = product({
      vehicle: vehicle({ matchLevel: 'SUB_MODEL', subModelId: 'sub-dn8' }),
    });
    assert.equal(matchProduct(p, { subModelIds: ['sub-lf'] }), null);
  });

  it('확정값이 요청 집합에 있으면 EXACT', () => {
    const p = product({
      vehicle: vehicle({ matchLevel: 'SUB_MODEL', subModelId: 'sub-dn8' }),
    });
    const match = matchProduct(p, { subModelIds: ['sub-dn8', 'sub-lf'] });
    assert.equal(match?.vehicleMatch.level, 'EXACT');
    assert.deepEqual(match?.vehicleMatch.unconfirmedAxes, []);
  });
});

describe('S-06 더 깊은 질문에는 PARTIAL 로 답한다', () => {
  it('트림을 물었는데 세부모델까지만 확정된 상품은 PARTIAL 로 남는다', () => {
    const p = product({
      vehicle: vehicle({ matchLevel: 'SUB_MODEL', subModelId: 'sub-dn8' }),
    });
    const match = matchProduct(p, { subModelIds: ['sub-dn8'], trimIds: ['trim-inspiration'] });
    assert.equal(match?.vehicleMatch.level, 'PARTIAL');
    assert.deepEqual(match?.vehicleMatch.unconfirmedAxes, ['TRIM']);
  });

  it('상위 축은 확정으로 인정한다 — 모델이 확정이면 제조사도 확정이다', () => {
    const p = product({ vehicle: vehicle({ matchLevel: 'MODEL' }) });
    const match = matchProduct(p, { manufacturerIds: ['mfr-hyundai'] });
    assert.equal(match?.vehicleMatch.level, 'EXACT');
  });
});

describe('S-07 UNMATCHED 는 차종 질의에서 빠진다', () => {
  const unmatched = product({
    vehicle: vehicle({ matchLevel: 'UNMATCHED', modelId: '', manufacturerId: '' }),
  });

  it('차종 축이 걸리면 제외한다', () => {
    assert.equal(matchProduct(unmatched, { modelIds: ['model-sonata'] }), null);
  });

  it('차종 축이 없는 검색에서는 정상 포함한다', () => {
    assert.ok(matchProduct(unmatched, { monthlyRent: { max: 700_000 } }));
  });
});

describe('S-08 미확인 ≠ 0 / 불가 / 무제한', () => {
  it('보증금 공란은 「보증금 0원」 검색에 들어가지 않는다', () => {
    const blank = product({ offers: [offer({ deposit: undefined })] });
    assert.equal(matchProduct(blank, { deposit: { max: 0 } }), null);
  });

  it('보증금 0 은 들어간다', () => {
    const zero = product({ offers: [offer({ deposit: 0 })] });
    assert.ok(matchProduct(zero, { deposit: { max: 0 } }));
  });

  it('약정주행거리 공란은 무제한으로 치지 않는다', () => {
    const blank = product({ offers: [offer({ annualMileageKm: undefined })] });
    assert.equal(matchProduct(blank, { annualMileageKm: { min: 20_000 } }), null);
  });

  it('범위 조건이 없으면 공란이어도 통과한다', () => {
    const blank = product({ offers: [offer({ deposit: undefined, annualMileageKm: undefined })] });
    assert.ok(matchProduct(blank, { termMonths: [36] }));
  });
});

describe('S-09 정책 미기재 ≠ 거짓', () => {
  const noPolicy = product({ offers: [offer({ policyValues: [] })] });

  it('true 요구에 걸리지 않는다', () => {
    assert.equal(
      matchProduct(noPolicy, { policies: [{ policyId: 'card', anyOf: [true] }] }),
      null,
    );
  });

  it('false 요구에도 걸리지 않는다 — 「없다」와 「안 된다」는 다르다', () => {
    assert.equal(
      matchProduct(noPolicy, { policies: [{ policyId: 'card', anyOf: [false] }] }),
      null,
    );
  });
});

describe('S-10 정책 해석 = 상품정책 + Offer정책', () => {
  it('상품 정책도 검색에 걸린다', () => {
    const p = product({
      productPolicies: [policy('card', 'BOOLEAN', true)],
      offers: [offer({ policyValues: [] })],
    });
    assert.ok(matchProduct(p, { policies: [{ policyId: 'card', anyOf: [true] }] }));
  });

  it('같은 policyId 면 Offer 가 상품을 덮는다', () => {
    const p = product({
      productPolicies: [policy('min-age', 'NUMBER', 26)],
      offers: [offer({ policyValues: [policy('min-age', 'NUMBER', 21)] })],
    });
    assert.ok(matchProduct(p, { policies: [{ policyId: 'min-age', anyOf: [21] }] }));
    assert.equal(matchProduct(p, { policies: [{ policyId: 'min-age', anyOf: [26] }] }), null);
  });

  it('Offer 마다 정책이 다르면 만족하는 Offer 만 걸린다 (S-02 와 함께)', () => {
    const p = product({
      offers: [
        offer({ id: 'o-card', policyValues: [policy('card', 'BOOLEAN', true)] }),
        offer({ id: 'o-cash', policyValues: [policy('card', 'BOOLEAN', false)] }),
      ],
    });
    const match = matchProduct(p, { policies: [{ policyId: 'card', anyOf: [true] }] });
    assert.deepEqual(match?.matchedOfferIds, ['o-card']);
  });
});

describe('S-11 MULTI_SELECT 는 OR', () => {
  const p = product({
    offers: [offer({ policyValues: [policy('docs', 'MULTI_SELECT', ['면허증', '주민등록등본'])] })],
  });

  it('요청값 중 하나라도 있으면 만족한다', () => {
    assert.ok(matchProduct(p, { policies: [{ policyId: 'docs', anyOf: ['주민등록등본'] }] }));
  });

  it('하나도 없으면 만족하지 않는다', () => {
    assert.equal(matchProduct(p, { policies: [{ policyId: 'docs', anyOf: ['재직증명서'] }] }), null);
  });
});

describe('S-12 EXACT 가 PARTIAL 보다 먼저 · 같은 등급은 입력 순서', () => {
  it('EXACT 를 앞으로 올리되 그 안 순서는 건드리지 않는다', () => {
    const partialA = product({
      id: 'partial-a',
      vehicle: vehicle({ matchLevel: 'MODEL' }),
    });
    const exactA = product({
      id: 'exact-a',
      vehicle: vehicle({ matchLevel: 'SUB_MODEL', subModelId: 'sub-dn8' }),
    });
    const exactB = product({
      id: 'exact-b',
      vehicle: vehicle({ matchLevel: 'TRIM', subModelId: 'sub-dn8', trimId: 'trim-x' }),
    });

    const result = searchProducts([partialA, exactA, exactB], { subModelIds: ['sub-dn8'] });
    assert.deepEqual(
      result.map((m) => m.product.id),
      ['exact-a', 'exact-b', 'partial-a'],
    );
  });
});

describe('S-13 Offer 없는 상품은 결과에 넣지 않는다', () => {
  it('접수로 이어질 조건이 없으면 「찾았다」고 하지 않는다', () => {
    assert.equal(matchProduct(product({ offers: [] }), {}), null);
  });
});

describe('공급사 축', () => {
  it('공급사 축도 같은 축 OR 규칙을 따른다', () => {
    const p = product({ supplierId: 'supplier-b' });
    assert.ok(matchProduct(p, { supplierIds: ['supplier-a', 'supplier-b'] }));
    assert.equal(matchProduct(p, { supplierIds: ['supplier-a'] }), null);
  });
});


describe('White Label parity — vehicle facts stay separate from Offer facts', () => {
  const p = product({
    productKind: '중고렌트',
    credit: '무심사',
    specs: { modelYear: 2024, mileageKm: 42_000, fuel: '하이브리드' },
    offers: [offer({ annualMileageKm: 20_000 })],
  });

  it('현재 차량 주행거리와 연 약정주행거리는 서로 다른 조건이다', () => {
    assert.ok(matchProduct(p, {
      vehicleMileageKm: { max: 50_000 },
      annualMileageKm: { min: 20_000, max: 20_000 },
    }));
    assert.equal(matchProduct(p, { vehicleMileageKm: { max: 30_000 } }), null);
    assert.equal(matchProduct(p, { annualMileageKm: { max: 10_000 } }), null);
  });

  it('현재 주행거리 미확인은 0km로 취급하지 않는다', () => {
    const unknown = product({ specs: { modelYear: 2024, fuel: '하이브리드' } });
    assert.equal(matchProduct(unknown, { vehicleMileageKm: { max: 10_000 } }), null);
  });

  it('상품구분·심사·연식·연료도 공통 finder 계약에서 판정한다', () => {
    assert.ok(matchProduct(p, {
      productKinds: ['중고렌트'],
      credits: ['무심사'],
      modelYears: [2024],
      fuels: ['하이브리드'],
    }));
    assert.equal(matchProduct(p, { productKinds: ['신차렌트'] }), null);
    assert.equal(matchProduct(p, { credits: ['신용조회'] }), null);
    assert.equal(matchProduct(p, { modelYears: [2025] }), null);
    assert.equal(matchProduct(p, { fuels: ['가솔린'] }), null);
  });
});


describe('White Label parity — customer vehicle class', () => {
  it('validated detailed vehicle class projects into the same four customer buckets', () => {
    const suv = product({ vehicleClass: '중형 SUV' });
    assert.ok(matchProduct(suv, { customerVehicleClasses: ['SUV'] }));
    assert.equal(matchProduct(suv, { customerVehicleClasses: ['승용'] }), null);
  });

  it('ambiguous vehicle class is not guessed into a customer bucket', () => {
    const ambiguous = product({ vehicleClass: '경형' });
    assert.equal(matchProduct(ambiguous, { customerVehicleClasses: ['승용'] }), null);
  });
});
