import assert from 'node:assert/strict';
import test from 'node:test';
import { createApplication } from '../domain/application/create-application';
import { updateApplicationProgress } from '../domain/application/update-progress';
import { createPerformanceFromDelivery } from '../domain/performance/performance';
import type { CanonicalProduct } from '../domain/product/types';
import { settlementPricingInput } from './settlement-pricing';

const t0='2026-09-21T00:00:00.000Z';
const t1='2026-09-21T01:00:00.000Z';
const actor={id:'admin-1',type:'ADMIN' as const};

const product:CanonicalProduct={
  id:'data-product-1',
  version:12,
  supplierId:'',
  supplierProductKey:'supplier-source-77',
  commercialType:'USED_RENT',
  vehiclePrice:42000000,
  vehicle:{
    nodeId:'vm-1',originId:'KR',manufacturerId:'현대',modelId:'싼타페',
    subModelId:'MX5',trimId:'캘리그래피',matchLevel:'TRIM',
  },
  specs:{modelYear:2026,fuel:'하이브리드',seats:6},
  registration:{vehicleNumber:'123하4567',vin:'VIN-DATA-1'},
  offers:[{
    id:'offer-1#36_2만',
    supplierId:'supplier-a',
    sourceOfferId:'offer-1',
    sourceOfferRevision:8,
    sourcePriceTermKey:'36_2만',
    termMonths:36,
    monthlyRent:920000,
    deposit:0,
    depositState:'ZERO',
    annualMileageKm:20000,
    policyValues:[{policyId:'basic_driver_age',type:'NUMBER',value:21}],
  }],
  productPolicies:[{policyId:'deposit_card_payment',type:'BOOLEAN',value:true}],
  sourceSnapshotId:'freepass-data:rel-22:data-product-1:12',
  updatedAt:t0,
};

test('Data provenance and pricing facts survive intake -> performance -> pricing input',()=>{
  const application=createApplication({
    id:'app-1',
    applicationNumber:'A-260921-001',
    applicantName:'홍길동',
    salesChannelId:'channel-1',
    assigneeId:'admin-1',
    source:'ADMIN',
    product,
    offerId:'offer-1#36_2만',
    submissionId:'sub-1',
    actor,
    now:t0,
  });
  const delivered=updateApplicationProgress(application,'deliveryCompleted',true,t1,actor);
  const performance=createPerformanceFromDelivery(delivered);
  const input=settlementPricingInput(performance,{
    paymentPlan:'2회분납',
    paidRounds:1,
    settleRatio:0.5,
  });

  assert.equal(application.snapshot.sourceSnapshotId,'freepass-data:rel-22:data-product-1:12');
  assert.equal(application.snapshot.supplierId,'supplier-a');
  assert.equal(application.snapshot.vehiclePrice,42000000);

  assert.equal(input.catalog.sourceSnapshotId,'freepass-data:rel-22:data-product-1:12');
  assert.equal(input.catalog.commercialType,'USED_RENT');
  assert.equal(input.catalog.vehiclePrice,42000000);
  assert.equal(input.catalog.offer.sourceOfferId,'offer-1');
  assert.equal(input.catalog.offer.sourceOfferRevision,8);
  assert.equal(input.catalog.offer.sourcePriceTermKey,'36_2만');
  assert.equal(input.catalog.offer.depositState,'ZERO');
  assert.equal(input.operational.paymentPlan,'2회분납');
  assert.equal(input.operational.paidRounds,1);
  assert.equal(input.operational.settleRatio,0.5);
});

test('historical performance without provenance remains readable and does not invent a release id',()=>{
  const application=createApplication({
    id:'app-legacy',
    applicationNumber:'A-260921-002',
    applicantName:'과거고객',
    salesChannelId:'channel-1',
    assigneeId:'admin-1',
    source:'ADMIN',
    product,
    offerId:'offer-1#36_2만',
    submissionId:'sub-legacy',
    actor,
    now:t0,
  });
  delete application.snapshot.sourceSnapshotId;
  const delivered=updateApplicationProgress(application,'deliveryCompleted',true,t1,actor);
  const performance=createPerformanceFromDelivery(delivered);
  const input=settlementPricingInput(performance);

  assert.equal(input.catalog.sourceSnapshotId,undefined);
});
