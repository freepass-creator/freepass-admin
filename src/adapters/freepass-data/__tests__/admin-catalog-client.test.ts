import assert from 'node:assert/strict';
import test from 'node:test';
import { __test } from '../admin-catalog-client';

const base = {
  productId: 'P-1',
  productRevision: 7,
  updatedAt: '2026-09-25T00:00:00.000Z',
  displayName: '그랜저',
  commercialType: 'USED_RENT' as const,
  vehicleModel: { id: 'VM-1', maker: '현대', model: '그랜저', subModel: 'GN7' },
  vehicleAsset: { id: 'VA-1', status: 'AVAILABLE' as const, plateNumber: '12가3456', vin: 'VIN-1', odometerKm: 21000 },
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
  assert.equal(product.registration?.vin, 'VIN-1');
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
