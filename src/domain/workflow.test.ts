import assert from 'node:assert/strict';
import test from 'node:test';
import { createApplication } from './application/create-application';
import { createAdminApplicationIdempotently, type ApplicationCreateStore } from './application/idempotency';
import { createPerformanceFromDelivery, confirmBySalesperson, confirmBySupplier, disputeBySalesperson, registerSupplierIssue, resolveOpenIssue, setSettlementAmounts } from './performance/performance';
import type { CanonicalProduct } from './product/types';
import { matchProduct } from './search/match-product';
import { createBilling, createSettlementFromPerformance, getSettlementBalance, registerCollection, registerPayout } from './settlement/settlement';

const now = '2026-09-13T00:00:00.000Z';
const product: CanonicalProduct = {
  id: 'product-1',
  version: 'version-7',
  displayName: '기아 카니발 9인승 시그니처',
  supplierId: 'supplier-1',
  supplierProductKey: 'supplier-key-1',
  vehicle: {
    nodeId: 'trim-1', originId: 'kr', manufacturerId: 'kia', modelId: 'carnival',
    subModelId: 'carnival-ka4', trimId: 'signature', matchLevel: 'TRIM',
  },
  specs: { modelYear: 2026, seats: 9 },
  offers: [
    {
      id: 'offer-24', termMonths: 24, monthlyRent: 810000, deposit: 1000000,
      annualMileageKm: 30000, policyValues: [],
    },
    {
      id: 'offer-36', termMonths: 36, monthlyRent: 729000, deposit: 0,
      annualMileageKm: 20000,
      policyValues: [{ policyId: 'payment', type: 'MULTI_SELECT', value: ['CARD', 'TRANSFER'] }],
    },
  ],
  productPolicies: [{ policyId: 'age', type: 'NUMBER', value: 21 }],
  sourceSnapshotId: 'snapshot-1',
  updatedAt: now,
};

function deliveredApplication() {
  const application = createApplication({
    id: 'application-1', applicationNumber: 'A-260913-001', submissionId: 'submission-1',
    customerName: '홍길동', salesChannelId: 'online', assigneeId: 'user-1', source: 'ADMIN',
    product, productVersion: product.version, offerId: 'offer-36', now,
  });
  return {
    ...application,
    status: 'DELIVERED' as const,
    progress: { ...application.progress, deliveryCompleted: true },
    deliveryEventId: 'delivery-1',
    deliveredAt: now,
  };
}

test('same-offer search never mixes contract conditions', () => {
  assert.equal(matchProduct(product, { termMonths: 24, maxDeposit: 0 }), null);
  const match = matchProduct(product, { termMonths: 36, maxDeposit: 0, maxMonthlyRent: 730000 });
  assert.deepEqual(match?.matchedOffers.map((offer) => offer.id), ['offer-36']);
});

test('search supports product policy scope and same-axis OR values', () => {
  const productPolicyMatch = matchProduct(product, {
    termMonthsAny: [24, 36], policies: [{ policyId: 'age', value: 21, scope: 'PRODUCT' }],
  });
  assert.deepEqual(productPolicyMatch?.matchedOffers.map((offer) => offer.id), ['offer-24', 'offer-36']);
});

test('trim-only search does not label another known sub-model as partial', () => {
  const otherSubModel: CanonicalProduct = {
    ...product,
    vehicle: { ...product.vehicle, subModelId: 'other-submodel', trimId: undefined, matchLevel: 'SUB_MODEL' },
  };
  assert.equal(matchProduct(otherSubModel, { trimId: 'signature' }), null);
});

test('application stores four required values and an isolated versioned snapshot', () => {
  const application = deliveredApplication();
  assert.equal(application.customerName, '홍길동');
  assert.equal(application.salesChannelId, 'online');
  assert.equal(application.assigneeId, 'user-1');
  assert.equal(application.snapshot.productVersion, 'version-7');

  const sourcePolicy = product.offers[1].policyValues[0];
  if (sourcePolicy.type !== 'MULTI_SELECT') throw new Error('fixture');
  sourcePolicy.value.push('CASH');
  const snapshotPolicy = application.snapshot.offer.policyValues[0];
  if (snapshotPolicy.type !== 'MULTI_SELECT') throw new Error('fixture');
  assert.deepEqual(snapshotPolicy.value, ['CARD', 'TRANSFER']);
  sourcePolicy.value.pop();
});

test('application rejects missing required intake values while phone remains optional', () => {
  assert.throws(() => createApplication({
    id: 'application-invalid', applicationNumber: 'A-INVALID', submissionId: 'submission-invalid',
    customerName: '', salesChannelId: 'online', assigneeId: 'user-1', source: 'ADMIN',
    product, productVersion: product.version, offerId: 'offer-36', now,
  }), /Customer name/);
  assert.equal(deliveredApplication().customerPhone, undefined);
});

test('idempotent application create replays the same request and rejects key reuse', async () => {
  const receipts = new Map<string, { fingerprint: string; application: ReturnType<typeof createApplication> }>();
  const store: ApplicationCreateStore = {
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
  };
  const input = {
    id: 'application-idempotent', applicationNumber: 'A-IDEMPOTENT', submissionId: 'submission-idempotent',
    customerName: '홍길동', salesChannelId: 'online', assigneeId: 'user-1',
    product, productVersion: product.version, offerId: 'offer-36', now,
  };
  assert.equal((await createAdminApplicationIdempotently('ADMIN', input, store)).outcome, 'CREATED');
  assert.equal((await createAdminApplicationIdempotently('ADMIN', input, store)).outcome, 'REPLAYED');
  await assert.rejects(() => createAdminApplicationIdempotently('ADMIN', { ...input, customerName: '다른 고객' }, store), /IDEMPOTENCY_KEY_REUSE/);
  assert.equal(receipts.size, 1);
});

test('SALES cannot enter the idempotent ADMIN application path', async () => {
  let calls = 0;
  const store: ApplicationCreateStore = {
    async createOrReplay(_submissionId, _fingerprint, create) {
      calls += 1;
      return { outcome: 'CREATED', application: create() };
    },
  };
  await assert.rejects(() => createAdminApplicationIdempotently('SALES', {
    id: 'application-blocked', applicationNumber: 'A-BLOCKED', submissionId: 'submission-blocked',
    customerName: '차단 고객', salesChannelId: 'online', assigneeId: 'user-1',
    product, productVersion: product.version, offerId: 'offer-36', now,
  }, store), /FORBIDDEN:APPLICATION_MANAGE/);
  assert.equal(calls, 0);
});

test('delivery becomes a reviewed settlement with independent partial ledgers', () => {
  let performance = createPerformanceFromDelivery(deliveredApplication(), 'performance:application-1', now);
  performance = setSettlementAmounts(performance, {
    supplierReceivable: 1500000, channelPayable: 1100000, vatMode: 'EXCLUDED',
  }, now);
  performance = confirmBySalesperson(performance, 'channel-1', 'admin-1', now);
  performance = confirmBySupplier(performance, 'supplier-admin-1', 'admin-1', now);
  assert.deepEqual(performance.salespersonReview, {
    status: 'CONFIRMED', partyId: 'channel-1', recordedByAdminId: 'admin-1', decidedAt: now,
  });
  assert.deepEqual(performance.supplierReview, {
    status: 'CONFIRMED', partyId: 'supplier-admin-1', recordedByAdminId: 'admin-1', decidedAt: now,
  });

  const finalized = createSettlementFromPerformance(performance, 'settlement:performance:application-1', now);
  assert.equal(finalized.settlement.margin, 400000);
  const billing = createBilling(finalized.settlement, `billing:${finalized.settlement.id}`, now);
  let ledger = registerCollection(finalized.settlement, billing, [], { id: 'collection-1', settlementId: finalized.settlement.id, account: 'SUPPLIER_COLLECTION', kind: 'CASH', amount: 700000, actorId: 'admin-1', occurredAt: now });
  const replayedLedger = registerCollection(finalized.settlement, billing, ledger, { id: 'collection-1', settlementId: finalized.settlement.id, account: 'SUPPLIER_COLLECTION', kind: 'CASH', amount: 700000, actorId: 'admin-1', occurredAt: now });
  assert.equal(replayedLedger.length, 1);
  assert.deepEqual(getSettlementBalance(finalized.settlement, billing, ledger), {
    confirmedReceivable: 1500000, billed: 1500000, collected: 700000, collectionOutstanding: 800000,
    payable: 1100000, paid: 0, payoutOutstanding: 1100000, margin: 400000,
  });
  assert.throws(() => registerPayout(finalized.settlement, billing, ledger, { id: 'payout-1', settlementId: finalized.settlement.id, account: 'CHANNEL_PAYOUT', kind: 'CASH', amount: 500000, actorId: 'admin-1', occurredAt: now }, 'AFTER_FULL_COLLECTION'));
  ledger = registerCollection(finalized.settlement, billing, ledger, { id: 'collection-2', settlementId: finalized.settlement.id, account: 'SUPPLIER_COLLECTION', kind: 'CASH', amount: 800000, actorId: 'admin-1', occurredAt: now });
  ledger = registerPayout(finalized.settlement, billing, ledger, { id: 'payout-1', settlementId: finalized.settlement.id, account: 'CHANNEL_PAYOUT', kind: 'CASH', amount: 500000, actorId: 'admin-1', occurredAt: now }, 'AFTER_FULL_COLLECTION');
  assert.equal(getSettlementBalance(finalized.settlement, billing, ledger).payoutOutstanding, 600000);
});

test('settlement cannot be finalized before salesperson and supplier confirmation', () => {
  let performance = createPerformanceFromDelivery(deliveredApplication(), 'performance:application-1', now);
  performance = setSettlementAmounts(performance, {
    supplierReceivable: 1000000, channelPayable: 700000, vatMode: 'INCLUDED',
  }, now);
  assert.throws(() => createSettlementFromPerformance(performance, 'settlement:performance:application-1', now), /not complete/);
  performance = confirmBySalesperson(performance, 'sales-1', 'admin-1', now);
  assert.throws(() => createSettlementFromPerformance(performance, 'settlement:performance:application-1', now), /not complete/);
});

test('recorded reviews require both the confirming party and recording ADMIN', () => {
  let performance = createPerformanceFromDelivery(deliveredApplication(), 'performance:application-1', now);
  performance = setSettlementAmounts(performance, {
    supplierReceivable: 1000000, channelPayable: 700000, vatMode: 'INCLUDED',
  }, now);
  assert.throws(() => confirmBySalesperson(performance, '', 'admin-1', now), /party id/);
  assert.throws(() => confirmBySalesperson(performance, 'channel-1', '', now), /admin id/);
});

test('same ledger id with a different payload is rejected', () => {
  let performance = createPerformanceFromDelivery(deliveredApplication(), 'performance:application-1', now);
  performance = setSettlementAmounts(performance, { supplierReceivable: 1000000, channelPayable: 700000, vatMode: 'INCLUDED' }, now);
  performance = confirmBySupplier(confirmBySalesperson(performance, 'sales-1', 'admin-1', now), 'supplier-1', 'admin-1', now);
  const { settlement } = createSettlementFromPerformance(performance, 'settlement:performance:application-1', now);
  const billing = createBilling(settlement, `billing:${settlement.id}`, now);
  const first = registerCollection(settlement, billing, [], { id: 'collection-same', settlementId: settlement.id, account: 'SUPPLIER_COLLECTION', kind: 'CASH', amount: 400000, actorId: 'admin-1', occurredAt: now });
  assert.throws(() => registerCollection(settlement, billing, first, { id: 'collection-same', settlementId: settlement.id, account: 'SUPPLIER_COLLECTION', kind: 'CASH', amount: 500000, actorId: 'admin-1', occurredAt: now }), /IDEMPOTENCY_KEY_REUSE/);
});

test('payout is blocked before billing and collection', () => {
  let performance = createPerformanceFromDelivery(deliveredApplication(), 'performance:application-1', now);
  performance = setSettlementAmounts(performance, { supplierReceivable: 1000000, channelPayable: 700000, vatMode: 'INCLUDED' }, now);
  performance = confirmBySupplier(confirmBySalesperson(performance, 'sales-1', 'admin-1', now), 'supplier-1', 'admin-1', now);
  const { settlement } = createSettlementFromPerformance(performance, 'settlement:performance:application-1', now);
  assert.throws(() => registerPayout(settlement, undefined, [], { id: 'payout-before-billing', settlementId: settlement.id, account: 'CHANNEL_PAYOUT', kind: 'CASH', amount: 700000, actorId: 'admin-1', occurredAt: now }, 'AFTER_FULL_COLLECTION'), /blocked/);
});

test('unresolved salesperson or supplier disputes cannot be finalized', () => {
  let performance = createPerformanceFromDelivery(deliveredApplication(), 'performance:application-1', now);
  performance = setSettlementAmounts(performance, { supplierReceivable: 1000000, channelPayable: 700000, vatMode: 'INCLUDED' }, now);
  performance = disputeBySalesperson(performance, 'sales-1', 'admin-1', '금액 다름', now);
  performance = confirmBySupplier(performance, 'supplier-1', 'admin-1', now);
  assert.equal(performance.status, 'SUPPLIER_ISSUE');
  assert.throws(() => createSettlementFromPerformance(performance, 'settlement:performance:application-1', now), /not complete/);
  performance = resolveOpenIssue(performance, 'admin-1', '양측 증빙 확인 후 기존 금액 합의', now);
  assert.equal(performance.status, 'READY_TO_FINALIZE');
});

test('supplier proposed amounts are preserved and payable changes require reconfirmation', () => {
  let performance = createPerformanceFromDelivery(deliveredApplication(), 'performance:application-1', now);
  performance = setSettlementAmounts(performance, { supplierReceivable: 1000000, channelPayable: 700000, vatMode: 'INCLUDED' }, now);
  performance = confirmBySalesperson(performance, 'sales-1', 'admin-1', now);
  performance = registerSupplierIssue(performance, 'supplier-1', 'admin-1', '정산표 금액 다름', { supplierReceivable: 900000, channelPayable: 650000, vatMode: 'INCLUDED' }, now);
  assert.equal(performance.amounts.supplierReceivable, 900000);
  assert.equal(performance.status, 'AWAITING_SALESPERSON_RECONFIRMATION');
});
