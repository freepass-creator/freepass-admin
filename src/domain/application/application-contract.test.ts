import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalProduct, PolicyValue } from '../product/types';
import { createApplication, type CreateApplicationInput } from './create-application';
import {
  createApplicationIdempotently,
  type ApplicationCreateStore,
} from './idempotency';

const now = '2026-09-13T00:00:00.000Z';

function product(): CanonicalProduct {
  return {
    id: 'product-1',
    version: 'version-7',
    supplierId: 'supplier-1',
    supplierProductKey: 'supplier-key-1',
    vehicle: {
      nodeId: 'test-model-node',
      originId: 'kr',
      manufacturerId: 'hyundai',
      modelId: 'sonata',
      matchLevel: 'MODEL',
    },
    specs: { modelYear: 2026 },
    offers: [
      {
        id: 'offer-18',
        termMonths: 18,
        monthlyRent: 700000,
        deposit: 3000000,
        annualMileageKm: 20000,
        policyValues: [
          { policyId: 'pay-methods', type: 'MULTI_SELECT', value: ['CARD', 'TRANSFER'] },
          { policyId: 'pay-time', type: 'SINGLE_SELECT', value: 'PREPAID' },
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
    productPolicies: [{ policyId: 'tags', type: 'MULTI_SELECT', value: ['A', 'B'] }],
    sourceSnapshotId: 'source-1',
    updatedAt: now,
  };
}

function input(overrides: Partial<CreateApplicationInput> = {}): CreateApplicationInput {
  const source = product();
  return {
    id: 'application-1',
    applicationNumber: 'A-260913-001',
    submissionId: 'submission-1',
    customerName: '홍길동',
    salesChannelId: 'channel-1',
    assigneeId: 'admin-1',
    source: 'ADMIN',
    product: source,
    productVersion: source.version,
    offerId: 'offer-18',
    now,
    ...overrides,
  };
}

function multiValue(policies: PolicyValue[], id: string): string[] {
  const policy = policies.find((item) => item.policyId === id);
  if (!policy || policy.type !== 'MULTI_SELECT') throw new Error(`Missing test policy: ${id}`);
  return policy.value;
}

function memoryStore(): ApplicationCreateStore & { size(): number } {
  const receipts = new Map<string, { fingerprint: string; application: ReturnType<typeof createApplication> }>();
  return {
    async createOrReplay(submissionId, fingerprint, create) {
      const existing = receipts.get(submissionId);
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_REUSE');
        return { outcome: 'REPLAYED', application: existing.application };
      }
      const application = create();
      receipts.set(submissionId, { fingerprint, application });
      return { outcome: 'CREATED', application };
    },
    size() {
      return receipts.size;
    },
  };
}

test('required intake is vehicle/offer, sales channel, assignee, and customer name; phone stays optional', () => {
  const application = createApplication(input());
  assert.equal(application.customerName, '홍길동');
  assert.equal(application.salesChannelId, 'channel-1');
  assert.equal(application.assigneeId, 'admin-1');
  assert.equal(application.snapshot.offer.id, 'offer-18');
  assert.equal(application.customerPhone, undefined);
  assert.throws(() => createApplication(input({ customerName: '  ' })), /Customer name/);
  assert.throws(() => createApplication(input({ salesChannelId: '' })), /Sales channel/);
  assert.throws(() => createApplication(input({ assigneeId: '' })), /Assignee/);
  assert.throws(() => createApplication(input({ submissionId: '' })), /Submission id/);
});

test('snapshot stores explicit productVersion and rejects a stale draft version', () => {
  const application = createApplication(input());
  assert.equal(application.snapshot.productVersion, 'version-7');
  assert.throws(
    () => createApplication(input({ productVersion: 'version-6' })),
    /PRODUCT_VERSION_CONFLICT/,
  );
});

test('MULTI_SELECT snapshot values are isolated from the source product', () => {
  const request = input();
  const application = createApplication(request);
  const sourceOffer = multiValue(request.product.offers[0].policyValues, 'pay-methods');
  const savedOffer = multiValue(application.snapshot.offer.policyValues, 'pay-methods');
  const sourceProduct = multiValue(request.product.productPolicies, 'tags');
  const savedProduct = multiValue(application.snapshot.productPolicies, 'tags');
  assert.notStrictEqual(sourceOffer, savedOffer);
  assert.notStrictEqual(sourceProduct, savedProduct);
  sourceOffer.splice(0, sourceOffer.length, 'UPDATED');
  sourceProduct.push('UPDATED');
  assert.deepEqual(savedOffer, ['CARD', 'TRANSFER']);
  assert.deepEqual(savedProduct, ['A', 'B']);
});

test('mutating a snapshot cannot change the source product or another application', () => {
  const request = input();
  const first = createApplication(request);
  const second = createApplication({ ...request, id: 'application-2', applicationNumber: 'A-002', submissionId: 'submission-2' });
  multiValue(first.snapshot.offer.policyValues, 'pay-methods').push('SNAPSHOT_ONLY');
  multiValue(first.snapshot.productPolicies, 'tags').pop();
  assert.deepEqual(multiValue(request.product.offers[0].policyValues, 'pay-methods'), ['CARD', 'TRANSFER']);
  assert.deepEqual(multiValue(second.snapshot.offer.policyValues, 'pay-methods'), ['CARD', 'TRANSFER']);
  assert.deepEqual(multiValue(second.snapshot.productPolicies, 'tags'), ['A', 'B']);
});

test('selected Offer and partial vehicle facts are preserved, not inferred', () => {
  const request = input();
  const application = createApplication(request);
  assert.equal(application.snapshot.vehicle.matchLevel, 'MODEL');
  assert.equal(application.snapshot.vehicle.subModelId, undefined);
  request.product.offers[0].monthlyRent = 999999;
  request.product.vehicle.modelId = 'changed';
  assert.equal(application.snapshot.offer.monthlyRent, 700000);
  assert.equal(application.snapshot.vehicle.modelId, 'sonata');
});

test('an Offer that does not belong to the product is rejected', () => {
  assert.throws(() => createApplication(input({ offerId: 'other-product-offer' })), /Selected offer/);
});

test('idempotent create replays the same submission and rejects key reuse with a different payload', async () => {
  const store = memoryStore();
  const request = input();
  assert.equal((await createApplicationIdempotently(request, store)).outcome, 'CREATED');
  assert.equal((await createApplicationIdempotently(request, store)).outcome, 'REPLAYED');
  await assert.rejects(
    () => createApplicationIdempotently({ ...request, customerName: '다른 고객' }, store),
    /IDEMPOTENCY_KEY_REUSE/,
  );
  assert.equal(store.size(), 1);
});
