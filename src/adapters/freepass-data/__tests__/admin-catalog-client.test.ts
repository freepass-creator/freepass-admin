import assert from 'node:assert/strict';
import test from 'node:test';
import { __test, ContractFeeLinkItemSchema } from '../admin-catalog-client';

test('가격행 계약 파서는 버전·실패 상태를 확인하고 화면에 불필요한 원문은 버린다', () => {
  const envelope = { contract: 'contract-fee-links/v1', results: [
    { key: 'example', status: 'FAILED', failure: 'CONDITION_MISMATCH', detail: 'example-private-detail',
      assetId: 'example-asset', priceTerm: { termKey: 'example-term' } },
  ] };
  assert.deepEqual(__test.ContractFeeLinksResponse.parse(envelope), {
    contract: 'contract-fee-links/v1', results: [{ key: 'example', status: 'FAILED', failure: 'CONDITION_MISMATCH' }],
  });
  assert.equal(__test.ContractFeeLinksResponse.safeParse({ ...envelope, contract: 'other' }).success, false);
  for (const result of [
    { key: 'example', status: 'FAILED' },
    { key: 'example', status: 'FAILED', failure: 'UNKNOWN_FAILURE' },
    { key: 'example', status: 'LINKED', failure: 'CONDITION_MISMATCH' },
  ]) assert.equal(__test.ContractFeeLinksResponse.safeParse({ ...envelope, results: [result] }).success, false);
});

test('가격행 요청 계약은 key·공급사 코드·기간 경계·유한 금액을 검증한다', () => {
  const item = { key: 'example', plate: 'EXAMPLE', supplierId: 'EXAMPLE-A', termMonths: 1, monthlyRent: 17 };
  assert.equal(ContractFeeLinkItemSchema.safeParse(item).success, true);
  assert.equal(ContractFeeLinkItemSchema.safeParse({ ...item, key: 'x'.repeat(120), termMonths: 120, deposit: 0 }).success, true);
  for (const patch of [{ key: '' }, { key: 'x'.repeat(121) }, { supplierId: '예시공급사A' },
    { termMonths: 0 }, { termMonths: 121 }, { termMonths: 1.5 }, { monthlyRent: NaN }, { deposit: -1 }])
    assert.equal(ContractFeeLinkItemSchema.safeParse({ ...item, ...patch }).success, false);
});

test('가격행 응답은 확정·미확정 수수료와 0을 구분하고 비정상 금액은 거부한다', () => {
  const result = { key: 'example', status: 'FEE_UNCONFIRMED', fees: {
    termKey: 'example-term', termMonths: 12,
    supplierBillingFee: { status: 'CONFIRMED', state: 'ZERO', amount: { amount: 0 } },
    channelPayoutFee: { status: 'UNCONFIRMED', state: 'UNKNOWN', amount: null },
  } };
  const envelope = { contract: 'contract-fee-links/v1', results: [result] };
  assert.equal(__test.ContractFeeLinksResponse.safeParse(envelope).success, true);
  result.fees.supplierBillingFee.amount.amount = Infinity;
  assert.equal(__test.ContractFeeLinksResponse.safeParse(envelope).success, false);
});

const base = {
  productId: 'P-1',
  productRevision: 7,
  updatedAt: '2026-09-25T00:00:00.000Z',
  displayName: '그랜저',
  commercialType: 'USED_RENT' as const,
  vehicleModel: {
    id: 'VM-1', origin: 'KR', maker: '현대', model: '그랜저', subModel: 'GN7', trim: '캘리그래피',
    modelYear: 2025, fuel: '가솔린', displacementCc: 2497, drive: 'FWD', seats: 5, batteryKwh: null,
  },
  vehicleAsset: {
    id: 'VA-1', status: 'AVAILABLE' as const, plateNumber: 'PLATEA', vin: 'VIN-1',
    odometerKm: 21000, firstRegistrationDate: '2025-01-15',
  },
  vehiclePrice: 48_000_000,
  offers: [
    {
      offerId: 'O-A', offerRevision: 3, supplierId: 'SUP-A',
      policyId: 'POL-A',
      policyState: 'COMPLETE' as const, invalidPolicyFactRefs: [],
      policyValues: [{ policyId: 'basic_driver_age', type: 'NUMBER' as const, value: 21 }],
      priceTerms: [
        { termKey: '36_2만', termMonths: 36, monthlyRent: { amount: 690000, currency: 'KRW' as const }, deposit: { amount: 0, currency: 'KRW' as const }, depositState: 'ZERO' as const, mileageLimitKmPerYear: 20000 },
        { termKey: '48_2만', termMonths: 48, monthlyRent: { amount: 650000, currency: 'KRW' as const }, depositState: 'UNKNOWN' as const, mileageLimitKmPerYear: 20000 },
      ],
      commercial: {
        offerId: 'O-A',
        supplierId: 'SUP-A',
        basisRows: [
          {
            termKey: '36_2만',
            monthlyRent: { amount: 690000, currency: 'KRW' as const },
            deposit: { state: 'ZERO' as const, amount: { amount: 0, currency: 'KRW' as const } },
            attribution: {
              status: 'PARTIAL' as const,
              conditions: [
                { dimensionKey: 'term_months', status: 'KNOWN' as const, value: 36, origin: 'CANONICAL_PRICE_TERM' as const, sourceRef: '36_2만' },
                { dimensionKey: 'annual_mileage_km', status: 'KNOWN' as const, value: 20000, origin: 'CANONICAL_PRICE_TERM' as const, sourceRef: '36_2만' },
                { dimensionKey: 'driver_age', status: 'KNOWN' as const, value: 21, origin: 'LINKED_POLICY_FACT' as const, sourceRef: 'POL-A:basic_driver_age' },
                { dimensionKey: 'additional_driver_count', status: 'UNKNOWN' as const, origin: 'UNRESOLVED' as const },
              ],
              unknownConditionKeys: ['additional_driver_count'],
              monthlyRentOrigin: { origin: 'CANONICAL_PRICE_TERM' as const, sourceRef: '36_2만' },
              depositOrigin: { origin: 'CANONICAL_PRICE_TERM' as const, sourceRef: '36_2만' },
            },
          },
          {
            termKey: '48_2만',
            monthlyRent: { amount: 650000, currency: 'KRW' as const },
            deposit: { state: 'UNKNOWN' as const },
            attribution: {
              status: 'PARTIAL' as const,
              conditions: [
                { dimensionKey: 'term_months', status: 'KNOWN' as const, value: 48, origin: 'CANONICAL_PRICE_TERM' as const, sourceRef: '48_2만' },
              ],
              unknownConditionKeys: ['additional_driver_count'],
              monthlyRentOrigin: { origin: 'CANONICAL_PRICE_TERM' as const, sourceRef: '48_2만' },
              depositOrigin: { origin: 'UNRESOLVED' as const },
            },
          },
        ],
        listing: {
          strategy: 'LOWEST_BASIS_MONTHLY_RENT' as const,
          termKey: '48_2만',
          monthlyRent: { amount: 650000, currency: 'KRW' as const },
          deposit: { state: 'UNKNOWN' as const },
          attribution: {
            status: 'PARTIAL' as const,
            conditions: [
              { dimensionKey: 'term_months', status: 'KNOWN' as const, value: 48, origin: 'CANONICAL_PRICE_TERM' as const, sourceRef: '48_2만' },
            ],
            unknownConditionKeys: ['additional_driver_count'],
            monthlyRentOrigin: { origin: 'CANONICAL_PRICE_TERM' as const, sourceRef: '48_2만' },
            depositOrigin: { origin: 'UNRESOLVED' as const },
          },
        },
        conditionSummary: {
          known: [
            { dimensionKey: 'term_months', status: 'KNOWN' as const, value: 36, origin: 'CANONICAL_PRICE_TERM' as const, sourceRef: '36_2만' },
          ],
          unknown: ['additional_driver_count'],
        },
        preview: {
          status: 'READY' as const,
          selection: { termMonths: 36, mileageKmPerYear: 20000, driverAge: 21, additionalDriverCount: 0, options: {} },
          basisTermKey: '36_2만',
          monthlyRent: { amount: 700000, currency: 'KRW' as const },
          deposit: { state: 'ZERO' as const, amount: { amount: 0, currency: 'KRW' as const } },
          decisions: [],
          invalidFacts: [],
        },
        review: { status: 'READY' as const, decisions: [], invalidFacts: [] },
      },
    },
    {
      offerId: 'O-B', offerRevision: 2, supplierId: 'SUP-B',
      policyState: 'MISSING' as const, invalidPolicyFactRefs: [], policyValues: [],
      priceTerms: [
        { termKey: '36_2만', termMonths: 36, monthlyRent: { amount: 710000, currency: 'KRW' as const }, depositState: 'NOT_APPLICABLE' as const },
      ],
    },
  ],
};

test('FreePass Data mapper preserves multi-supplier Offers and unknown deposit semantics', () => {
  const parsed = __test.ResponseSchema.shape.data.element.parse(base);
  const product = __test.mapProduct(parsed);
  assert.equal(product.id, 'P-1');
  assert.equal(product.supplierId, '');
  assert.deepEqual(product.offers.map((o) => o.supplierId), ['SUP-A','SUP-A','SUP-B']);
  assert.deepEqual(product.offers.slice(0, 2).map((o) => o.sourceOfferId), ['O-A','O-A']);
  assert.deepEqual(product.offers.slice(0, 2).map((o) => o.policyId), ['POL-A','POL-A']);
  assert.deepEqual(product.offers.slice(0, 2).map((o) => o.offerRevision), [3,3]);
  assert.deepEqual(product.offers.slice(0, 2).map((o) => o.policyState), ['COMPLETE','COMPLETE']);
  assert.equal(product.offers[0]?.deposit, 0);
  assert.equal(product.offers[0]?.monthlyRent, 690000);
  assert.equal(product.offers[0]?.basisMonthlyRent, 690000);
  assert.equal(product.offers[0]?.previewMonthlyRent, 700000);
  assert.equal(product.offers[0]?.isDefaultPreview, true);
  assert.equal(product.offers[0]?.isListingPrice, false);
  assert.equal(product.offers[1]?.isListingPrice, true);
  assert.equal(product.offers[0]?.conditionStatus, 'PARTIAL');
  assert.deepEqual(product.offers[0]?.unknownConditionKeys, ['additional_driver_count']);
  assert.equal(product.offers[0]?.conditionEvidence?.find((x) => x.dimensionKey === 'driver_age')?.origin, 'LINKED_POLICY_FACT');
  assert.equal(product.offers[1]?.deposit, undefined);
  assert.equal(product.offers[2]?.deposit, undefined);
  assert.equal(product.consumerPrice, 48_000_000);
  assert.equal(product.vehicle.originId, 'KR');
  assert.equal(product.vehicle.trimId, '캘리그래피');
  assert.equal(product.specs.modelYear, 2025);
  assert.equal(product.specs.displacementCc, 2497);
  assert.equal(product.specs.drivetrain, 'FWD');
  assert.equal(product.registration?.vin, 'VIN-1');
  assert.equal(product.registration?.firstRegistrationDate, '2025-01-15');
  assert.equal(product.policyState, 'MISSING');
});

test('FreePass Data mapper snapshot identity changes when an Offer revision changes', () => {
  const parsed = __test.ResponseSchema.shape.data.element.parse(base);
  const first = __test.mapProduct(parsed);
  const changed = structuredClone(base);
  changed.offers[0]!.offerRevision = 4;
  const second = __test.mapProduct(__test.ResponseSchema.shape.data.element.parse(changed));
  assert.notEqual(first.sourceSnapshotId, second.sourceSnapshotId);
});

test('FreePass Data contract parser rejects ZERO deposit without explicit 0 KRW', () => {
  const broken = structuredClone(base);
  delete (broken.offers[0]!.priceTerms[0] as { deposit?: unknown }).deposit;
  assert.throws(() => __test.ResponseSchema.shape.data.element.parse(broken));
});


test('FreePass Data snapshot identity changes when price or policy changes without a revision bump', () => {
  const first = __test.mapProduct(__test.ResponseSchema.shape.data.element.parse(base));

  const priceChanged = structuredClone(base);
  priceChanged.offers[0]!.priceTerms[0]!.monthlyRent.amount += 10_000;
  const second = __test.mapProduct(__test.ResponseSchema.shape.data.element.parse(priceChanged));
  assert.notEqual(first.sourceSnapshotId, second.sourceSnapshotId);

  const policyChanged = structuredClone(base);
  policyChanged.offers[0]!.policyValues[0]!.value = 26;
  const third = __test.mapProduct(__test.ResponseSchema.shape.data.element.parse(policyChanged));
  assert.notEqual(first.sourceSnapshotId, third.sourceSnapshotId);
});

test('FreePass Data snapshot identity is stable across policy and offer ordering only', () => {
  const left = __test.mapProduct(__test.ResponseSchema.shape.data.element.parse(base));
  const reordered = structuredClone(base);
  reordered.offers.reverse();
  reordered.offers[1]!.policyValues.reverse();
  const right = __test.mapProduct(__test.ResponseSchema.shape.data.element.parse(reordered));
  assert.equal(left.sourceSnapshotId, right.sourceSnapshotId);
});


test('FreePass Data client config only accepts a clean production HTTPS origin and strong token', () => {
  const good = __test.config({
    NODE_ENV:'production',
    FREEPASS_DATA_BASE_URL:'https://data.example.test/',
    FREEPASS_DATA_ADMIN_CATALOG_TOKEN:'t'.repeat(40),
  });
  assert.equal(good.base,'https://data.example.test');
  assert.throws(() => __test.config({
    NODE_ENV:'production',
    FREEPASS_DATA_BASE_URL:'http://data.example.test',
    FREEPASS_DATA_ADMIN_CATALOG_TOKEN:'t'.repeat(40),
  }),/MUST_BE_HTTPS/);
  for(const url of [
    'https://user:pass' + String.fromCharCode(64) + 'data.example.test',
    'https://data.example.test/api',
    'https://data.example.test/?x=1',
    'https://data.example.test/#x',
  ]){
    assert.throws(() => __test.config({
      NODE_ENV:'production',
      FREEPASS_DATA_BASE_URL:url,
      FREEPASS_DATA_ADMIN_CATALOG_TOKEN:'t'.repeat(40),
    }),/MUST_BE_ORIGIN/);
  }
  assert.throws(() => __test.config({
    NODE_ENV:'production',
    FREEPASS_DATA_BASE_URL:'https://data.example.test',
    FREEPASS_DATA_ADMIN_CATALOG_TOKEN:'short',
  }),/TOKEN_INVALID/);
});

const economicFee = (state: 'KNOWN' | 'ZERO' | 'UNKNOWN' | 'NOT_APPLICABLE', amount = 123456) => ({
  state, amount: state === 'KNOWN' || state === 'ZERO' ? { amount: state === 'ZERO' ? 0 : amount, currency: 'KRW' as const } : null,
  calculation: state === 'KNOWN' || state === 'ZERO' ? { kind: 'FIXED' as const, amount: { amount: state === 'ZERO' ? 0 : amount, currency: 'KRW' as const } } : null,
  sourceRefs: ['fee-source'], policyId: 'policy-fee', ruleId: 'rule-fee', reasonCode: state === 'UNKNOWN' ? 'NO_RULE' : null,
  vatTreatment: 'EXCLUDED' as const, vatAmount: null, totalAmount: null,
});
const productWithFees = (claim: unknown, pay: unknown) => ({ ...base, offers: [{ ...base.offers[0], priceTerms: [
  { ...base.offers[0].priceTerms[0], supplierBillingFee: claim, channelPayoutFee: pay },
  base.offers[0].priceTerms[1],
] }] });

test('term economics preserve Data fields for each selected term, including ZERO and UNKNOWN', () => {
  for (const state of ['KNOWN', 'ZERO', 'UNKNOWN', 'NOT_APPLICABLE'] as const) {
    const fee = economicFee(state);
    const mapped = __test.mapProduct(__test.ResponseSchema.shape.data.element.parse(productWithFees(fee, fee)));
    assert.deepEqual(mapped.offers[0].supplierBillingFee, fee);
    assert.deepEqual(mapped.offers[0].channelPayoutFee, fee);
    assert.equal(mapped.offers[1].supplierBillingFee, undefined);
  }
});

test('malformed present economics fail closed; absent economics remain compatible', () => {
  assert.doesNotThrow(() => __test.ResponseSchema.shape.data.element.parse(base));
  const known = economicFee('KNOWN');
  for (const bad of [null, {}, { ...known, amount: null }, { ...known, amount: { amount: -1, currency: 'KRW' } },
    { ...known, amount: { amount: 1.1, currency: 'KRW' } }, { ...known, amount: { amount: 1, currency: 'USD' } },
    { ...known, state: 'ZERO' }, { ...known, state: 'UNKNOWN' }, { ...known, calculation: null },
    { ...known, calculation: { kind: 'RATE', base: 'GUESS', rate: 0.1 } }, { ...known, sourceRefs: [] },
    { ...known, vatAmount: -1 }, { ...known, vatTreatment: 'GUESSED' }, { ...known, policyId: '' },
  ]) {
    for (const [claim, pay] of [[bad, known], [known, bad]])
      assert.throws(() => __test.ResponseSchema.shape.data.element.parse(productWithFees(claim, pay)));
  }
});

test('sourceSnapshotId changes when term economics change without a product revision change', () => {
  const map = (f: unknown) => __test.mapProduct(__test.ResponseSchema.shape.data.element.parse(productWithFees(f, economicFee('ZERO'))));
  const first = map(economicFee('KNOWN'));
  for (const changed of [economicFee('KNOWN', 999), economicFee('UNKNOWN'), { ...economicFee('KNOWN'), ruleId: 'new-rule' }])
    assert.notEqual(map(changed).sourceSnapshotId, first.sourceSnapshotId);
});

test('economicsCoverage is optional, typed, and never treated as COMPLETE when missing', () => {
  const meta = {
    consumerId: 'freepass-admin-catalog', projectionId: 'admin-catalog', authority: 'CANONICAL_ACTIVE', schemaVersion: '1.0.0',
    releaseId: 'r', manifestId: 'm', inputDigest: 'i', dataDigest: 'd', revision: 1, generatedAt: 'now', activatedAt: 'now',
    policyParity: 'COMPLETE', missingPolicyOfferIds: [], invalidPolicyFactRefs: [],
  };
  assert.equal(__test.ResponseSchema.shape.meta.parse(meta).economicsCoverage, undefined);
  for (const coverage of ['COMPLETE', 'INCOMPLETE'])
    assert.equal(__test.ResponseSchema.shape.meta.parse({ ...meta, economicsCoverage: coverage }).economicsCoverage, coverage);
  assert.throws(() => __test.ResponseSchema.shape.meta.parse({ ...meta, economicsCoverage: 'READY' }));
});
