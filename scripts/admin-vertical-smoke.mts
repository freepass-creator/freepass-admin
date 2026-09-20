import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileOperationsRepository } from '../src/adapters/store/operations-repository';
import { FileApplicationRepository, FileProductRepository } from '../src/adapters/store/repositories';
import type { CanonicalProduct } from '../src/domain/product/types';
import { getSettlementBalance } from '../src/domain/settlement/settlement';
import { markProgress, submitApplication } from '../src/services/applications';
import {
  confirmSalesperson,
  confirmSupplier,
  ensurePerformanceForApplication,
  ensureSettlementBilling,
  finalizeSettlement,
  recordCollection,
  recordPayout,
  setPerformanceAmounts,
} from '../src/services/settlement-operations';

const actor={id:'smoke-admin',type:'ADMIN' as const};
const actors={requireActor:async()=>actor};
const nowValues=[
  '2026-09-20T09:00:00.000Z',
  '2026-09-20T09:01:00.000Z',
  '2026-09-20T09:02:00.000Z',
  '2026-09-20T09:03:00.000Z',
  '2026-09-20T09:04:00.000Z',
  '2026-09-20T09:05:00.000Z',
  '2026-09-20T09:06:00.000Z',
  '2026-09-20T09:07:00.000Z',
  '2026-09-20T09:08:00.000Z',
  '2026-09-20T09:09:00.000Z',
  '2026-09-20T09:10:00.000Z',
];
let nowIndex=0;
const now=()=>new Date(nowValues[Math.min(nowIndex++,nowValues.length-1)]);

const productSeed:CanonicalProduct={
  id:'smoke-product',
  version:0,
  supplierId:'smoke-supplier',
  supplierProductKey:'smoke-raw-1',
  vehicle:{
    nodeId:'smoke-k5',
    originId:'kr',
    manufacturerId:'kia',
    modelId:'k5',
    matchLevel:'MODEL',
  },
  specs:{modelYear:2026,seats:5},
  registration:{vehicleNumber:'12가3456',vin:'SMOKE-VIN-1'},
  offers:[{
    id:'smoke-offer-36',
    termMonths:36,
    monthlyRent:700000,
    deposit:0,
    annualMileageKm:20000,
    policyValues:[],
  }],
  productPolicies:[{policyId:'min-age',type:'NUMBER',value:21}],
  sourceSnapshotId:'smoke-source',
  updatedAt:'2026-09-20T08:59:00.000Z',
};

const dir=await mkdtemp(join(tmpdir(),'freepass-admin-smoke-'));

try{
  const products=new FileProductRepository(dir);
  const applications=new FileApplicationRepository(dir);
  const operations=new FileOperationsRepository(dir);

  const savedProduct=await products.save(productSeed);
  assert.equal(savedProduct.version,1);

  const submitted=await submitApplication({
    products,
    applications,
    actors,
    now,
    newId:()=> 'smoke-application',
  },{
    productId:savedProduct.id,
    offerId:'smoke-offer-36',
    salesChannelId:'smoke-channel',
    assigneeId:'smoke-admin',
    applicantName:'스모크고객',
    applicantPhone:'010-0000-0000',
    expectedProductVersion:savedProduct.version,
    submissionId:'smoke-submission',
    source:'ADMIN',
  });
  assert.equal(submitted.ok,true);
  if(!submitted.ok)throw new Error('submit failed');

  const replayed=await submitApplication({
    products,
    applications,
    actors,
    now,
    newId:()=> 'should-not-be-used',
  },{
    productId:savedProduct.id,
    offerId:'smoke-offer-36',
    salesChannelId:'smoke-channel',
    assigneeId:'smoke-admin',
    applicantName:'스모크고객',
    applicantPhone:'010-0000-0000',
    expectedProductVersion:savedProduct.version,
    submissionId:'smoke-submission',
    source:'ADMIN',
  });
  assert.equal(replayed.ok,true);
  if(!replayed.ok)throw new Error('replay failed');
  assert.equal(replayed.created,false);

  for(const key of ['contractCompleted','documentsCompleted','balanceCompleted','deliveryCompleted'] as const){
    const progress=await markProgress({applications,actors,now},submitted.application.id,key,true);
    assert.equal(progress.ok,true);
  }

  const storedApplication=await applications.get(submitted.application.id);
  assert.equal(storedApplication?.status,'DELIVERED');
  assert.equal(storedApplication?.snapshot.registration?.vehicleNumber,'12가3456');

  const settlementDeps={applications,operations,actors,now};

  const performanceResult=await ensurePerformanceForApplication(settlementDeps,submitted.application.id);
  assert.equal(performanceResult.created,true);
  assert.equal(
    (await ensurePerformanceForApplication(settlementDeps,submitted.application.id)).created,
    false,
  );
  assert.equal(performanceResult.performance.snapshot.registration?.vehicleNumber,'12가3456');

  let performance=await setPerformanceAmounts(
    settlementDeps,
    performanceResult.performance.id,
    {supplierReceivable:1500000,channelPayable:1100000,vatMode:'EXCLUDED'},
  );
  assert.equal(performance.status,'AWAITING_SALESPERSON_CONFIRMATION');

  performance=await confirmSalesperson(settlementDeps,performance.id,'smoke-channel');
  assert.equal(performance.status,'AWAITING_SUPPLIER_REVIEW');

  performance=await confirmSupplier(settlementDeps,performance.id,'smoke-supplier');
  assert.equal(performance.status,'READY_TO_FINALIZE');

  const finalized=await finalizeSettlement(settlementDeps,performance.id);
  assert.equal(finalized.created,true);
  assert.equal(finalized.performance.status,'FINALIZED');
  assert.equal(finalized.settlement.margin,400000);
  assert.equal((await finalizeSettlement(settlementDeps,performance.id)).created,false);

  const billingResult=await ensureSettlementBilling(settlementDeps,finalized.settlement.id);
  assert.equal(billingResult.created,true);
  assert.equal(
    (await ensureSettlementBilling(settlementDeps,finalized.settlement.id)).created,
    false,
  );

  await recordCollection(settlementDeps,finalized.settlement.id,{
    id:'smoke-collection-1',
    amount:700000,
    note:'smoke partial collection',
  });

  let ledger=await operations.listLedger(finalized.settlement.id);
  let balance=getSettlementBalance(finalized.settlement,billingResult.billing,ledger);
  assert.equal(balance.collectionOutstanding,800000);

  await assert.rejects(
    ()=>recordPayout(settlementDeps,finalized.settlement.id,{
      id:'smoke-payout-early',
      amount:100000,
      note:'must be blocked',
      policy:'AFTER_FULL_COLLECTION',
    }),
    /blocked/,
  );

  await recordCollection(settlementDeps,finalized.settlement.id,{
    id:'smoke-collection-2',
    amount:800000,
    note:'smoke collection complete',
  });

  await recordPayout(settlementDeps,finalized.settlement.id,{
    id:'smoke-payout-1',
    amount:1100000,
    note:'smoke payout complete',
    policy:'AFTER_FULL_COLLECTION',
  });

  const reopenedApplications=new FileApplicationRepository(dir);
  const reopenedOperations=new FileOperationsRepository(dir);

  const persistedApplication=await reopenedApplications.get(submitted.application.id);
  const persistedPerformance=await reopenedOperations.getPerformance(performance.id);
  const persistedSettlement=await reopenedOperations.getSettlement(finalized.settlement.id);
  const persistedBilling=await reopenedOperations.getBillingBySettlementId(finalized.settlement.id);
  ledger=await reopenedOperations.listLedger(finalized.settlement.id);

  assert.equal(persistedApplication?.status,'DELIVERED');
  assert.equal(persistedPerformance?.status,'FINALIZED');
  assert.ok(persistedSettlement);
  assert.ok(persistedBilling);
  if(!persistedSettlement||!persistedBilling)throw new Error('persisted finance records missing');

  balance=getSettlementBalance(persistedSettlement,persistedBilling,ledger);
  assert.equal(balance.collectionOutstanding,0);
  assert.equal(balance.payoutOutstanding,0);
  assert.equal(balance.margin,400000);

  console.log(JSON.stringify({
    schema:'freepass-admin-vertical-smoke/v1',
    status:'PASS',
    evidence:{
      productVersion:savedProduct.version,
      applicationId:persistedApplication?.id,
      applicationStatus:persistedApplication?.status,
      applicationNumber:persistedApplication?.applicationNumber,
      vehicleNumber:persistedApplication?.snapshot.registration?.vehicleNumber,
      performanceId:persistedPerformance?.id,
      performanceStatus:persistedPerformance?.status,
      settlementId:persistedSettlement.id,
      billingId:persistedBilling.id,
      ledgerEntries:ledger.length,
      collectionOutstanding:balance.collectionOutstanding,
      payoutOutstanding:balance.payoutOutstanding,
      margin:balance.margin,
    },
  },null,2));
}finally{
  await rm(dir,{recursive:true,force:true});
}
