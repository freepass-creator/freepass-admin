import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createApplication } from '../../domain/application/create-application';
import { updateApplicationProgress } from '../../domain/application/update-progress';
import {
  confirmBySalesperson,
  confirmBySupplier,
  createPerformanceFromDelivery,
  setSettlementAmounts,
} from '../../domain/performance/performance';
import {
  createBilling,
  createClawbackBillingAdjustment,
  createSettlementClawback,
  createSettlementFromPerformance,
  getSettlementBalance,
  recordBillingInvoiceEvidence,
  recordClawbackBillingInvoiceEvidence,
  registerCollection,
} from '../../domain/settlement/settlement';
import type { CanonicalProduct } from '../../domain/product/types';
import { FileOperationsRepository } from './operations-repository';

const t0='2026-09-20T00:00:00.000Z';
const t1='2026-09-20T01:00:00.000Z';
const actor={id:'admin-1',type:'ADMIN' as const};

const product:CanonicalProduct={
  id:'p1',version:1,supplierId:'s1',supplierProductKey:'raw-1',
  vehicle:{nodeId:'n1',originId:'kr',manufacturerId:'kia',modelId:'k5',matchLevel:'MODEL'},
  specs:{},offers:[{id:'o1',termMonths:36,monthlyRent:700000,deposit:0,policyValues:[]}],
  productPolicies:[],sourceSnapshotId:'source-1',updatedAt:t0,
};

function candidate(){
  const app=createApplication({
    id:'a1',applicationNumber:'A-260920-001',applicantName:'홍길동',salesChannelId:'channel-1',
    assigneeId:'admin-1',source:'ADMIN',product,offerId:'o1',submissionId:'sub-1',actor,now:t0,
  });
  const delivered=updateApplicationProgress(app,'deliveryCompleted',true,t1,actor);
  return createPerformanceFromDelivery(delivered);
}

test('operations repository persists atomic settlement state across instances',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fpa-ops-'));
  try{
    const first=new FileOperationsRepository(dir);
    const ensured=await first.ensurePerformance(candidate());
    assert.equal(ensured.created,true);
    assert.equal((await first.ensurePerformance(candidate())).created,false);

    await first.mutatePerformance(ensured.performance.id,(p)=>
      confirmBySupplier(
        confirmBySalesperson(
          setSettlementAmounts(p,{supplierReceivable:1000000,channelPayable:700000,vatMode:'EXCLUDED'},t1),
          'channel-1','admin-1',t1,
        ),
        's1','admin-1',t1,
      ),
    );

    const finalized=await first.finalizePerformance(
      ensured.performance.id,
      (p)=>createSettlementFromPerformance(p,t1),
    );
    assert.equal(finalized.created,true);
    assert.equal(finalized.performance.status,'FINALIZED');

    const second=new FileOperationsRepository(dir);
    const persisted=await second.getPerformance(ensured.performance.id);
    const settlement=await second.findSettlementByPerformanceId(ensured.performance.id);
    assert.equal(persisted?.status,'FINALIZED');
    assert.ok(settlement);

    if(!settlement)throw new Error('fixture');
    const billing=(await second.ensureBilling(settlement.id,()=>createBilling(settlement,t1))).billing;
    const evidenced=await second.mutateBilling(settlement.id,(current)=>recordBillingInvoiceEvidence(current,{
      reference:'INV-STORE-001',
      issuedAt:'2026-09-20',
      recordedAt:t1,
      recordedBy:'admin-1',
    }));
    assert.equal(evidenced.status,'EVIDENCE_COMPLETE');
    await second.mutateLedger(settlement.id,(entries)=>registerCollection(
      settlement,evidenced,entries,{
        id:'c1',settlementId:settlement.id,account:'SUPPLIER_COLLECTION',kind:'CASH',
        amount:400000,occurredAt:t1,actorId:'admin-1',
      },
    ));

    const clawback=createSettlementClawback(settlement,[],{
      id:'clawback-store-1',
      supplierAmount:500000,
      reason:'유지조건 미충족',
      occurredAt:'2026-10-20T00:00:00.000Z',
      createdAt:'2026-10-20T00:00:00.000Z',
      createdBy:'admin-1',
    });
    assert.equal((await second.ensureClawback(settlement.id,clawback)).created,true);
    assert.equal((await second.ensureClawback(settlement.id,clawback)).created,false);

    const clawbackBilling=(await second.ensureClawbackBilling(
      clawback.id,
      ()=>createClawbackBillingAdjustment(
        settlement,
        clawback,
        '2026-10-20T00:01:00.000Z',
      ),
    )).adjustment;
    const clawbackBillingDone=await second.mutateClawbackBilling(
      clawback.id,
      (current)=>recordClawbackBillingInvoiceEvidence(current,{
        reference:'CREDIT-STORE-001',
        issuedAt:'2026-10-20',
        recordedAt:'2026-10-20T00:02:00.000Z',
        recordedBy:'admin-1',
      }),
    );
    assert.equal(clawbackBilling.status,'CREATED');
    assert.equal(clawbackBillingDone.status,'EVIDENCE_COMPLETE');

    const third=new FileOperationsRepository(dir);
    const persistedClawbacks=await third.listClawbacks(settlement.id);
    assert.equal(persistedClawbacks.length,1);
    assert.equal(persistedClawbacks[0]?.supplierAmount,500000);
    assert.equal(persistedClawbacks[0]?.channelAmount,350000);
    const persistedCredit=await third.getClawbackBillingByClawbackId(clawback.id);
    assert.equal(persistedCredit?.status,'EVIDENCE_COMPLETE');
    assert.equal(persistedCredit?.invoiceEvidence?.reference,'CREDIT-STORE-001');

    const ledger=await third.listLedger(settlement.id);
    assert.equal(getSettlementBalance(settlement,evidenced,ledger).collectionOutstanding,600000);
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
});
