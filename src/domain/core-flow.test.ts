import assert from 'node:assert/strict';
import test from 'node:test';
import { createApplication } from './application/create-application';
import { updateApplicationProgress } from './application/update-progress';
import {
  confirmBySalesperson,
  confirmBySupplier,
  createPerformanceFromDelivery,
  disputeBySalesperson,
  reconfirmBySalesperson,
  registerSupplierIssue,
  resolveOpenIssue,
  setSettlementAmounts,
} from './performance/performance';
import type { CanonicalProduct } from './product/types';
import { matchProduct } from './search/match-product';
import {
  createBilling,
  createSettlementFromPerformance,
  getSettlementBalance,
  registerCollection,
  registerPayout,
  reverseLedgerEntry,
} from './settlement/settlement';

const t0='2026-09-20T00:00:00.000Z';
const t1='2026-09-20T01:00:00.000Z';
const actor={id:'admin-1',type:'ADMIN' as const};

const product:CanonicalProduct={
  id:'product-1',version:7,supplierId:'supplier-1',supplierProductKey:'raw-1',
  vehicle:{nodeId:'trim-1',originId:'kr',manufacturerId:'kia',modelId:'carnival',subModelId:'ka4',trimId:'signature',matchLevel:'TRIM'},
  specs:{modelYear:2026,seats:9},
  registration:{vehicleNumber:'12가3456',vin:'VIN-CORE-FLOW'},
  offers:[
    {id:'o24',termMonths:24,monthlyRent:810000,deposit:1000000,annualMileageKm:30000,policyValues:[]},
    {id:'o36',termMonths:36,monthlyRent:729000,deposit:0,annualMileageKm:20000,policyValues:[]},
  ],
  productPolicies:[{policyId:'min-age',type:'NUMBER',value:21}],
  sourceSnapshotId:'snapshot-7',updatedAt:t0,
};

function deliveredApplication(){
  const app=createApplication({
    id:'application-1',
    applicationNumber:'A-260920-001',
    applicantName:'홍길동',
    salesChannelId:'online',
    assigneeId:'admin-1',
    source:'ADMIN',
    product,
    offerId:'o36',
    submissionId:'submission-1',
    actor,
    now:t0,
  });
  const contracted=updateApplicationProgress(app,'contractCompleted',true,t0,actor);
  return updateApplicationProgress(contracted,'deliveryCompleted',true,t1,actor);
}

test('상품찾기에서 고른 같은 Offer가 접수 snapshot으로 이어지고 인도 사실이 실적을 만든다',()=>{
  const hit=matchProduct(product,{termMonths:[36],deposit:{max:0},monthlyRent:{max:730000}});
  assert.deepEqual(hit?.matchedOfferIds,['o36']);

  const application=deliveredApplication();
  assert.equal(application.snapshot.offer.id,'o36');
  assert.equal(application.status,'DELIVERED');

  const performance=createPerformanceFromDelivery(application);
  assert.equal(performance.id,'performance:application-1');
  assert.equal(performance.snapshot.offer.id,'o36');
  assert.equal(performance.snapshot.productVersion,7);
  assert.equal(application.snapshot.registration?.vehicleNumber,'12가3456');
  assert.equal(performance.snapshot.registration?.vehicleNumber,'12가3456');
  assert.equal(performance.snapshot.deliveredAt,t1);
});

test('인도 상태만 조작하고 delivery 감사사실이 없으면 실적을 만들 수 없다',()=>{
  const app=createApplication({
    id:'fake-delivery',applicationNumber:'A-FAKE',applicantName:'가짜',salesChannelId:'online',assigneeId:'admin-1',
    source:'ADMIN',product,offerId:'o36',submissionId:'fake-submit',actor,now:t0,
  });
  const fake={...app,status:'DELIVERED' as const,progress:{...app.progress,deliveryCompleted:true}};
  assert.throws(()=>createPerformanceFromDelivery(fake),/Delivery completion evidence/);
});

test('인도→실적→금액확정→영업채널확인→공급사확인→정산→부분수금→완납→지급이 연결된다',()=>{
  let performance=createPerformanceFromDelivery(deliveredApplication());
  performance=setSettlementAmounts(performance,{
    supplierReceivable:1500000,
    channelPayable:1100000,
    vatMode:'EXCLUDED',
  },t1);
  performance=confirmBySalesperson(performance,'channel-1','admin-1',t1);
  performance=confirmBySupplier(performance,'supplier-1','admin-1',t1);

  const finalized=createSettlementFromPerformance(performance,t1);
  assert.equal(finalized.performance.status,'FINALIZED');
  assert.equal(finalized.settlement.margin,400000);

  const billing=createBilling(finalized.settlement,t1);
  let ledger=registerCollection(finalized.settlement,billing,[],{
    id:'collection-1',settlementId:finalized.settlement.id,account:'SUPPLIER_COLLECTION',
    kind:'CASH',amount:700000,occurredAt:t1,actorId:'admin-1',
  });
  assert.equal(getSettlementBalance(finalized.settlement,billing,ledger).collectionOutstanding,800000);

  assert.throws(()=>registerPayout(finalized.settlement,billing,ledger,{
    id:'payout-early',settlementId:finalized.settlement.id,account:'CHANNEL_PAYOUT',
    kind:'CASH',amount:500000,occurredAt:t1,actorId:'admin-1',
  },'AFTER_FULL_COLLECTION'),/blocked/);

  ledger=registerCollection(finalized.settlement,billing,ledger,{
    id:'collection-2',settlementId:finalized.settlement.id,account:'SUPPLIER_COLLECTION',
    kind:'CASH',amount:800000,occurredAt:t1,actorId:'admin-1',
  });
  ledger=registerPayout(finalized.settlement,billing,ledger,{
    id:'payout-1',settlementId:finalized.settlement.id,account:'CHANNEL_PAYOUT',
    kind:'CASH',amount:500000,occurredAt:t1,actorId:'admin-1',
  },'AFTER_FULL_COLLECTION');

  const balance=getSettlementBalance(finalized.settlement,billing,ledger);
  assert.equal(balance.collectionOutstanding,0);
  assert.equal(balance.payoutOutstanding,600000);
});

test('수금/지급 원장은 같은 id 다른 금액 재사용을 막고 reversal을 별도 사실로 남긴다',()=>{
  let performance=createPerformanceFromDelivery(deliveredApplication());
  performance=confirmBySupplier(
    confirmBySalesperson(
      setSettlementAmounts(performance,{supplierReceivable:1000000,channelPayable:700000,vatMode:'INCLUDED'},t1),
      'channel-1','admin-1',t1,
    ),
    'supplier-1','admin-1',t1,
  );
  const {settlement}=createSettlementFromPerformance(performance,t1);
  const billing=createBilling(settlement,t1);
  let ledger=registerCollection(settlement,billing,[],{
    id:'collection-x',settlementId:settlement.id,account:'SUPPLIER_COLLECTION',
    kind:'CASH',amount:400000,occurredAt:t1,actorId:'admin-1',
  });
  assert.throws(()=>registerCollection(settlement,billing,ledger,{
    id:'collection-x',settlementId:settlement.id,account:'SUPPLIER_COLLECTION',
    kind:'CASH',amount:500000,occurredAt:t1,actorId:'admin-1',
  }),/IDEMPOTENCY_KEY_REUSE/);

  ledger=reverseLedgerEntry(settlement,ledger,{
    id:'reversal-x',settlementId:settlement.id,account:'SUPPLIER_COLLECTION',
    kind:'REVERSAL',amount:400000,occurredAt:t1,actorId:'admin-1',reversalOfEntryId:'collection-x',
  });
  assert.equal(getSettlementBalance(settlement,billing,ledger).collected,0);
  assert.throws(()=>reverseLedgerEntry(settlement,ledger,{
    id:'reversal-x2',settlementId:settlement.id,account:'SUPPLIER_COLLECTION',
    kind:'REVERSAL',amount:400000,occurredAt:t1,actorId:'admin-1',reversalOfEntryId:'collection-x',
  }),/already reversed/);
});

test('완납 후 지급정책에서는 지급을 먼저 되돌려야 수금 reversal이 가능하다',()=>{
  let performance=createPerformanceFromDelivery(deliveredApplication());
  performance=confirmBySupplier(
    confirmBySalesperson(
      setSettlementAmounts(performance,{supplierReceivable:1000000,channelPayable:700000,vatMode:'INCLUDED'},t1),
      'channel-1','admin-1',t1,
    ),
    'supplier-1','admin-1',t1,
  );
  const {settlement}=createSettlementFromPerformance(performance,t1);
  const billing=createBilling(settlement,t1);
  let ledger=registerCollection(settlement,billing,[],{
    id:'collection-full',settlementId:settlement.id,account:'SUPPLIER_COLLECTION',
    kind:'CASH',amount:1000000,occurredAt:t1,actorId:'admin-1',
  });
  ledger=registerPayout(settlement,billing,ledger,{
    id:'payout-full',settlementId:settlement.id,account:'CHANNEL_PAYOUT',
    kind:'CASH',amount:700000,occurredAt:t1,actorId:'admin-1',
  },'AFTER_FULL_COLLECTION');

  assert.throws(()=>reverseLedgerEntry(settlement,ledger,{
    id:'reverse-collection-first',settlementId:settlement.id,account:'SUPPLIER_COLLECTION',
    kind:'REVERSAL',amount:1000000,occurredAt:t1,actorId:'admin-1',reversalOfEntryId:'collection-full',
  }),/Reverse channel payout/);

  ledger=reverseLedgerEntry(settlement,ledger,{
    id:'reverse-payout',settlementId:settlement.id,account:'CHANNEL_PAYOUT',
    kind:'REVERSAL',amount:700000,occurredAt:t1,actorId:'admin-1',reversalOfEntryId:'payout-full',
  });
  ledger=reverseLedgerEntry(settlement,ledger,{
    id:'reverse-collection',settlementId:settlement.id,account:'SUPPLIER_COLLECTION',
    kind:'REVERSAL',amount:1000000,occurredAt:t1,actorId:'admin-1',reversalOfEntryId:'collection-full',
  });
  const balance=getSettlementBalance(settlement,billing,ledger);
  assert.equal(balance.collected,0);
  assert.equal(balance.paid,0);
});

test('금액 이견은 자동 확정하지 않고 재확인 또는 명시적 해결을 요구한다',()=>{
  let performance=createPerformanceFromDelivery(deliveredApplication());
  performance=setSettlementAmounts(performance,{supplierReceivable:1000000,channelPayable:700000,vatMode:'INCLUDED'},t1);
  performance=confirmBySalesperson(performance,'channel-1','admin-1',t1);
  performance=registerSupplierIssue(
    performance,'supplier-1','admin-1','공급사 정산표와 다름',
    {supplierReceivable:950000,channelPayable:650000,vatMode:'INCLUDED'},t1,
  );
  assert.equal(performance.status,'AWAITING_SALESPERSON_RECONFIRMATION');
  assert.throws(()=>createSettlementFromPerformance(performance,t1),/not complete/);
  performance=reconfirmBySalesperson(performance,'channel-1','admin-1',t1);
  assert.equal(performance.status,'READY_TO_FINALIZE');

  let disputed=createPerformanceFromDelivery(deliveredApplication());
  disputed=setSettlementAmounts(disputed,{supplierReceivable:1000000,channelPayable:700000,vatMode:'INCLUDED'},t1);
  disputed=disputeBySalesperson(disputed,'channel-1','admin-1','채널 금액 이견',t1);
  disputed=confirmBySupplier(disputed,'supplier-1','admin-1',t1);
  assert.equal(disputed.status,'SUPPLIER_ISSUE');
  disputed=resolveOpenIssue(disputed,'admin-1','증빙 대조 후 합의',t1);
  assert.equal(disputed.status,'READY_TO_FINALIZE');
});
