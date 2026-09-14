import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalProduct, Offer } from '../product/types';
import { matchProduct, pickMatchedOffer } from './match-product';

const now = '2026-09-13T00:00:00.000Z';

function offer(partial: Partial<Offer> & Pick<Offer, 'id' | 'termMonths' | 'monthlyRent'>): Offer {
  return { deposit: 0, annualMileageKm: 20000, policyValues: [], ...partial };
}

function product(partial: Partial<CanonicalProduct> & Pick<CanonicalProduct, 'id' | 'vehicle'>): CanonicalProduct {
  return {
    version: 'v1',
    supplierId: 'supplier-a',
    supplierProductKey: `${partial.id}-key`,
    specs: {},
    offers: [offer({ id: `${partial.id}-36`, termMonths: 36, monthlyRent: 690000 })],
    productPolicies: [],
    sourceSnapshotId: `${partial.id}-source`,
    updatedAt: now,
    ...partial,
  };
}

const sonataModelOnly = product({
  id: 'p-sonata-model',
  vehicle: {
    nodeId: 'sonata',
    originId: 'kr',
    manufacturerId: 'hyundai',
    modelId: 'sonata',
    matchLevel: 'MODEL',
  },
});

const sonataDn8 = product({
  id: 'p-sonata-dn8',
  vehicle: {
    nodeId: 'sonata-dn8-trim',
    originId: 'kr',
    manufacturerId: 'hyundai',
    modelId: 'sonata',
    subModelId: 'dn8',
    trimId: 'inspiration',
    matchLevel: 'TRIM',
  },
});

const sonataTheEdge = product({
  id: 'p-sonata-edge',
  vehicle: {
    nodeId: 'sonata-edge',
    originId: 'kr',
    manufacturerId: 'hyundai',
    modelId: 'sonata',
    subModelId: 'the-edge',
    matchLevel: 'SUB_MODEL',
  },
});

const k5 = product({
  id: 'p-k5',
  vehicle: {
    nodeId: 'k5',
    originId: 'kr',
    manufacturerId: 'kia',
    modelId: 'k5',
    subModelId: 'dl3',
    trimId: 'noblesse',
    matchLevel: 'TRIM',
  },
});

const mixedOffers = product({
  id: 'p-mixed-offers',
  vehicle: sonataDn8.vehicle,
  offers: [
    offer({ id: 'offer-18', termMonths: 18, monthlyRent: 700000, deposit: 3000000, annualMileageKm: 20000 }),
    offer({
      id: 'offer-36',
      termMonths: 36,
      monthlyRent: 650000,
      deposit: 0,
      annualMileageKm: 30000,
      policyValues: [{ policyId: 'pay-time', type: 'SINGLE_SELECT', value: 'POSTPAID' }],
    }),
    offer({ id: 'offer-60', termMonths: 60, monthlyRent: 590000, deposit: 0, annualMileageKm: 20000 }),
  ],
  productPolicies: [{ policyId: 'min-age', type: 'NUMBER', value: 21 }],
});

const unknownDeposit = product({
  id: 'p-unknown-deposit',
  vehicle: sonataDn8.vehicle,
  offers: [offer({ id: 'offer-unknown-deposit', termMonths: 36, monthlyRent: 650000, deposit: undefined })],
});

test('SIM-A01: model search includes model-only and confirmed descendants, excludes other models', () => {
  assert.equal(matchProduct(sonataModelOnly, { modelId: 'sonata' })?.vehicleMatch, 'EXACT');
  assert.equal(matchProduct(sonataDn8, { modelId: 'sonata' })?.product.id, 'p-sonata-dn8');
  assert.equal(matchProduct(sonataTheEdge, { modelId: 'sonata' })?.product.id, 'p-sonata-edge');
  assert.equal(matchProduct(k5, { modelId: 'sonata' }), null);
});

test('SIM-A02: confirmed other sub-model is not a PARTIAL candidate', () => {
  assert.equal(matchProduct(sonataDn8, { modelId: 'sonata', subModelId: 'dn8' })?.vehicleMatch, 'EXACT');
  assert.equal(matchProduct(sonataModelOnly, { modelId: 'sonata', subModelId: 'dn8' })?.vehicleMatch, 'PARTIAL');
  assert.equal(matchProduct(sonataTheEdge, { modelId: 'sonata', subModelId: 'dn8' }), null);
});

test('SIM-A03: same axis OR, other axes AND, and a single matching Offer', () => {
  const match = matchProduct(mixedOffers, {
    modelIds: ['sonata', 'k5'],
    termMonths: 36,
    maxDeposit: 0,
  });
  assert.deepEqual(match?.matchedOffers.map((item) => item.id), ['offer-36']);
  assert.equal(matchProduct(mixedOffers, { modelIds: ['k5'], termMonths: 36, maxDeposit: 0 }), null);
});

test('SIM-A04: search never mixes values from different Offers', () => {
  assert.equal(matchProduct(mixedOffers, { termMonths: 18, maxMonthlyRent: 750000, maxDeposit: 0 }), null);
  const match = matchProduct(mixedOffers, { termMonths: 18, maxMonthlyRent: 750000, maxDeposit: 3000000 });
  assert.deepEqual(match?.matchedOffers.map((item) => item.id), ['offer-18']);
});

test('SIM-A05: matched offer continuity keeps the filtered term, not the cheapest Offer', () => {
  const match = matchProduct(mixedOffers, { termMonths: 24 });
  assert.equal(match, null);
  const month36 = matchProduct(mixedOffers, { termMonths: 36 });
  assert.equal(pickMatchedOffer(month36!).id, 'offer-36');
  assert.equal(pickMatchedOffer(month36!).monthlyRent, 650000);
  assert.notEqual(pickMatchedOffer(month36!).id, 'offer-60');
  const continued = pickMatchedOffer(month36!, 'offer-36');
  assert.equal(continued.id, 'offer-36');
});

test('SIM-A06: unknown deposit is not treated as 0 / no-deposit', () => {
  assert.equal(matchProduct(unknownDeposit, { maxDeposit: 0 }), null);
  assert.equal(matchProduct(unknownDeposit, { termMonths: 36 })?.matchedOffers[0]?.deposit, undefined);
});

test('SIM-A07: product-scope and offer-scope policies do not substitute for each other', () => {
  const age = matchProduct(mixedOffers, {
    policies: [{ policyId: 'min-age', value: 21, scope: 'PRODUCT' }],
  });
  assert.ok(age);
  assert.equal(
    matchProduct(mixedOffers, {
      policies: [{ policyId: 'min-age', value: 21, scope: 'OFFER' }],
    }),
    null,
  );
  const postpaid = matchProduct(mixedOffers, {
    termMonths: 36,
    policies: [{ policyId: 'pay-time', value: 'POSTPAID', scope: 'OFFER' }],
  });
  assert.deepEqual(postpaid?.matchedOffers.map((item) => item.id), ['offer-36']);
  assert.equal(
    matchProduct(mixedOffers, {
      termMonths: 18,
      policies: [{ policyId: 'pay-time', value: 'POSTPAID', scope: 'OFFER' }],
    }),
    null,
  );
});

test('trim search does not mix in another confirmed sub-model as PARTIAL', () => {
  assert.equal(matchProduct(sonataTheEdge, { trimId: 'inspiration' }), null);
  assert.equal(matchProduct(sonataModelOnly, { trimId: 'inspiration' })?.vehicleMatch, 'PARTIAL');
  assert.equal(matchProduct(sonataDn8, { trimId: 'inspiration' })?.vehicleMatch, 'EXACT');
  assert.equal(
    matchProduct(sonataTheEdge, { subModelId: 'the-edge', trimId: 'inspiration' })?.vehicleMatch,
    'PARTIAL',
  );
});

test('same-axis term OR still requires one Offer to satisfy the rest of the query', () => {
  const match = matchProduct(mixedOffers, { termMonthsAny: [18, 36], maxDeposit: 0, maxMonthlyRent: 660000 });
  assert.deepEqual(match?.matchedOffers.map((item) => item.id), ['offer-36']);
});
