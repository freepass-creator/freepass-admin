import assert from 'node:assert/strict';
import test from 'node:test';
import { __test } from '../admin-catalog-client';

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
    id: 'VA-1', status: 'AVAILABLE' as const, plateNumber: '12가3456', vin: 'VIN-1',
    odometerKm: 21000, firstRegistrationDate: '2025-01-15',
  },
  vehiclePrice: 48_000_000,
  offers: [
    {
      offerId: 'O-A', offerRevision: 3, supplierId: 'SUP-A',
      policyState: 'COMPLETE' as const, invalidPolicyFactRefs: [],
      policyValues: [{ policyId: 'basic_driver_age', type: 'NUMBER' as const, value: 21 }],
      priceTerms: [
        { termKey: '36_2만', termMonths: 36, monthlyRent: { amount: 690000, currency: 'KRW' as const }, deposit: { amount: 0, currency: 'KRW' as const }, depositState: 'ZERO' as const, mileageLimitKmPerYear: 20000 },
        { termKey: '48_2만', termMonths: 48, monthlyRent: { amount: 650000, currency: 'KRW' as const }, depositState: 'UNKNOWN' as const, mileageLimitKmPerYear: 20000 },
      ],
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
  assert.equal(product.offers[0]?.deposit, 0);
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
    'https://user:pass@data.example.test',
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
