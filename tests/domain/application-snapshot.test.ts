import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApplication, type CreateApplicationInput } from '../../src/domain/application/create-application';
import type { PolicyValue } from '../../src/domain/product/types';

/** 가상 데이터만 사용한다. 실제 공급사·고객·시트·Firebase에 접근하지 않는다. */
function fixture(): CreateApplicationInput {
  return {
    id: 'test-application-1',
    applicationNumber: 'TEST-001',
    applicantName: '가상 테스트',
    applicantPhone: 'TEST_ONLY',
    source: 'ADMIN',
    now: '2026-09-13T00:00:00.000Z',
    offerId: 'offer-18',
    product: {
      id: 'test-product',
      supplierId: 'test-supplier',
      supplierProductKey: 'test-source-key',
      sourceSnapshotId: 'test-source-snapshot',
      updatedAt: '2026-09-13T00:00:00.000Z',
      vehicle: {
        nodeId: 'test-model-node',
        originId: 'test-origin',
        manufacturerId: 'test-manufacturer',
        modelId: 'test-model',
        matchLevel: 'MODEL',
      },
      specs: {},
      offers: [
        {
          id: 'offer-18',
          termMonths: 18,
          monthlyRent: 700000,
          deposit: 3000000,
          annualMileageKm: 20000,
          policyValues: [
            { policyId: 'test-methods', type: 'MULTI_SELECT', value: ['CARD', 'TRANSFER'] },
            { policyId: 'test-timing', type: 'SINGLE_SELECT', value: 'PREPAID' },
          ],
        },
        {
          id: 'offer-36',
          termMonths: 36,
          monthlyRent: 650000,
          deposit: 0,
          policyValues: [],
        },
      ],
      productPolicies: [
        { policyId: 'test-product-tags', type: 'MULTI_SELECT', value: ['A', 'B'] },
      ],
    },
  };
}

function multiValue(policies: PolicyValue[], id: string): string[] {
  const policy = policies.find((item) => item.policyId === id);
  if (!policy || policy.type !== 'MULTI_SELECT') throw new Error(`Missing test policy: ${id}`);
  return policy.value;
}

// These mutation tests fail under the old shallow-copy implementation.
test('01: changing source Offer policy choices cannot change a saved snapshot', () => {
  const input = fixture();
  const app = createApplication(input);
  const source = multiValue(input.product.offers[0].policyValues, 'test-methods');
  const saved = multiValue(app.snapshot.offer.policyValues, 'test-methods');
  assert.notStrictEqual(source, saved);
  source.splice(0, source.length, 'UPDATED');
  assert.deepEqual(saved, ['CARD', 'TRANSFER']);
});

test('02: changing source product policy choices cannot change a saved snapshot', () => {
  const input = fixture();
  const app = createApplication(input);
  const source = multiValue(input.product.productPolicies, 'test-product-tags');
  const saved = multiValue(app.snapshot.productPolicies, 'test-product-tags');
  assert.notStrictEqual(source, saved);
  source.push('UPDATED');
  assert.deepEqual(saved, ['A', 'B']);
});

test('03: snapshot choices cannot mutate the original product in either policy scope', () => {
  const input = fixture();
  const app = createApplication(input);
  multiValue(app.snapshot.offer.policyValues, 'test-methods').push('SNAPSHOT_ONLY');
  multiValue(app.snapshot.productPolicies, 'test-product-tags').push('SNAPSHOT_ONLY');
  assert.deepEqual(multiValue(input.product.offers[0].policyValues, 'test-methods'), ['CARD', 'TRANSFER']);
  assert.deepEqual(multiValue(input.product.productPolicies, 'test-product-tags'), ['A', 'B']);
});

test('04: two applications created from one product do not share policy choice arrays', () => {
  const input = fixture();
  const first = createApplication(input);
  const second = createApplication({ ...input, id: 'test-application-2', applicationNumber: 'TEST-002' });
  multiValue(first.snapshot.offer.policyValues, 'test-methods').pop();
  multiValue(first.snapshot.productPolicies, 'test-product-tags').pop();
  assert.deepEqual(multiValue(second.snapshot.offer.policyValues, 'test-methods'), ['CARD', 'TRANSFER']);
  assert.deepEqual(multiValue(second.snapshot.productPolicies, 'test-product-tags'), ['A', 'B']);
});

test('05: scalar policy types and values are preserved without reusing policy objects', () => {
  const input = fixture();
  const scalars: PolicyValue[] = [
    { policyId: 'b', type: 'BOOLEAN', value: false },
    { policyId: 'n', type: 'NUMBER', value: 21 },
    { policyId: 'm', type: 'MONEY', value: 0 },
    { policyId: 'p', type: 'PERCENTAGE', value: 0 },
    { policyId: 's', type: 'SINGLE_SELECT', value: 'PREPAID' },
    { policyId: 't', type: 'TEXT', value: '' },
    { policyId: 'd', type: 'DATE', value: '2026-09-13' },
  ];
  input.product.offers[0].policyValues = scalars;
  input.product.productPolicies = scalars;
  const app = createApplication(input);
  assert.deepEqual(app.snapshot.offer.policyValues, scalars);
  assert.deepEqual(app.snapshot.productPolicies, scalars);
  scalars.forEach((policy, index) => {
    assert.notStrictEqual(app.snapshot.offer.policyValues[index], policy);
    assert.notStrictEqual(app.snapshot.productPolicies[index], policy);
  });
});

test('06: the selected Offer and partial model are preserved, not borrowed or inferred', () => {
  const input = fixture();
  const app = createApplication(input);
  assert.equal(app.snapshot.offer.id, 'offer-18');
  assert.equal(app.snapshot.offer.termMonths, 18);
  assert.equal(app.snapshot.offer.monthlyRent, 700000);
  assert.equal(app.snapshot.offer.deposit, 3000000);
  assert.equal(app.snapshot.vehicle.matchLevel, 'MODEL');
  assert.equal(app.snapshot.vehicle.subModelId, undefined);
  assert.equal(app.snapshot.vehicle.trimId, undefined);
  input.product.offers[0].monthlyRent = 999999;
  input.product.vehicle.modelId = 'changed-source';
  assert.equal(app.snapshot.offer.monthlyRent, 700000);
  assert.equal(app.snapshot.vehicle.modelId, 'test-model');
});

test('07: an Offer not belonging to the product is rejected', () => {
  const input = fixture();
  assert.throws(
    () => createApplication({ ...input, offerId: 'other-product-offer' }),
    /Selected offer does not belong to the product/,
  );
});

test('08: creating an application leaves the source unchanged and initializes receipt facts', () => {
  const input = fixture();
  delete input.product.offers[0].deposit;
  const original = structuredClone(input);
  const app = createApplication(input);
  assert.deepEqual(input, original);
  assert.equal(app.snapshot.offer.deposit, undefined);
  assert.equal(app.status, 'RECEIVED');
  assert.deepEqual(app.progress, {
    contractCompleted: false,
    documentsCompleted: false,
    deliveryCompleted: false,
  });
  assert.equal(app.snapshot.capturedAt, input.now);
  assert.equal(app.createdAt, input.now);
  assert.equal(app.updatedAt, input.now);
});
