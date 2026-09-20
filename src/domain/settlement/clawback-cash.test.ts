import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSettlementClawback,
  getClawbackCashBalance,
  getSettlementNetBalance,
  recordBillingInvoiceEvidence,
  registerChannelRecovery,
  registerCollection,
  registerPayout,
  registerSupplierRefund,
  reverseLedgerEntry,
} from './settlement';
import type { BillingRecord, LedgerEntry, SettlementItem } from './types';

const settlement:SettlementItem={
  id:'settlement:1',
  performanceId:'performance:1',
  applicationId:'application:1',
  applicationNumber:'A-260921-001',
  applicantName:'홍길동',
  supplierId:'supplier-a',
  salesChannelId:'channel-a',
  assigneeId:'admin-1',
  supplierReceivable:1_000_000,
  channelPayable:800_000,
  margin:200_000,
  vatMode:'EXCLUDED',
  createdAt:'2026-09-21T00:00:00.000Z',
};
const billing:BillingRecord=recordBillingInvoiceEvidence({
  id:'billing:1',
  settlementId:settlement.id,
  supplierId:settlement.supplierId,
  amount:settlement.supplierReceivable,
  status:'CREATED',
  createdAt:'2026-09-21T00:00:00.000Z',
},{
  reference:'INV-1',
  issuedAt:'2026-09-21',
  recordedAt:'2026-09-21T00:01:00.000Z',
  recordedBy:'admin-1',
});

const clawback=createSettlementClawback(settlement,[],{
  id:'clawback:1',
  supplierAmount:500_000,
  reason:'유지조건 미충족',
  occurredAt:'2026-10-01T00:00:00.000Z',
  createdAt:'2026-10-01T00:00:00.000Z',
  createdBy:'admin-1',
});

function collection(amount:number,id='collection:1'):LedgerEntry{
  return{
    id,settlementId:settlement.id,account:'SUPPLIER_COLLECTION',kind:'CASH',
    amount,occurredAt:'2026-09-22T00:00:00.000Z',actorId:'admin-1',
  };
}
function payout(amount:number,id='payout:1'):LedgerEntry{
  return{
    id,settlementId:settlement.id,account:'CHANNEL_PAYOUT',kind:'CASH',
    amount,occurredAt:'2026-09-23T00:00:00.000Z',actorId:'admin-1',
  };
}

test('clawback reduces future collection and payout limits before any refund/recovery cash movement',()=>{
  const net=getSettlementNetBalance(settlement,billing,[],[clawback]);
  assert.deepEqual(net,{
    originalReceivable:1_000_000,
    supplierClawback:500_000,
    netReceivable:500_000,
    collected:0,
    supplierRefunded:0,
    netCollected:0,
    collectionOutstanding:500_000,
    supplierRefundOutstanding:0,
    originalPayable:800_000,
    channelClawback:400_000,
    netPayable:400_000,
    paid:0,
    channelRecovered:0,
    netPaid:0,
    payoutOutstanding:400_000,
    channelRecoveryOutstanding:0,
    netMargin:100_000,
  });

  const collected=registerCollection(settlement,billing,[],collection(500_000),[clawback]);
  assert.equal(getSettlementNetBalance(settlement,billing,collected,[clawback]).collectionOutstanding,0);
  assert.throws(
    ()=>registerCollection(settlement,billing,collected,collection(1,'collection:2'),[clawback]),
    /exceed the outstanding balance/,
  );
});

test('already over-collected/over-paid settlement opens refund and recovery only for the excess',()=>{
  let ledger:LedgerEntry[]=[
    collection(1_000_000),
    payout(800_000),
  ];
  const net=getSettlementNetBalance(settlement,billing,ledger,[clawback]);
  assert.equal(net.supplierRefundOutstanding,500_000);
  assert.equal(net.channelRecoveryOutstanding,400_000);
  assert.equal(net.collectionOutstanding,0);
  assert.equal(net.payoutOutstanding,0);

  ledger=registerSupplierRefund(
    settlement,billing,[clawback],clawback,ledger,{
      id:'supplier-refund:1',
      settlementId:settlement.id,
      clawbackId:clawback.id,
      account:'SUPPLIER_REFUND',
      kind:'CASH',
      amount:300_000,
      occurredAt:'2026-10-02T00:00:00.000Z',
      actorId:'admin-1',
    },
  );
  ledger=registerChannelRecovery(
    settlement,billing,[clawback],clawback,ledger,{
      id:'channel-recovery:1',
      settlementId:settlement.id,
      clawbackId:clawback.id,
      account:'CHANNEL_RECOVERY',
      kind:'CASH',
      amount:400_000,
      occurredAt:'2026-10-03T00:00:00.000Z',
      actorId:'admin-1',
    },
  );

  const after=getSettlementNetBalance(settlement,billing,ledger,[clawback]);
  assert.equal(after.supplierRefunded,300_000);
  assert.equal(after.supplierRefundOutstanding,200_000);
  assert.equal(after.channelRecovered,400_000);
  assert.equal(after.channelRecoveryOutstanding,0);

  const cash=getClawbackCashBalance(clawback,ledger);
  assert.equal(cash.supplierRefunded,300_000);
  assert.equal(cash.supplierRefundRemaining,200_000);
  assert.equal(cash.channelRecovered,400_000);
  assert.equal(cash.channelRecoveryRemaining,0);
});

test('refund/recovery cannot be recorded when original cash never exceeded the clawback-adjusted target',()=>{
  assert.throws(
    ()=>registerSupplierRefund(settlement,billing,[clawback],clawback,[],{
      id:'supplier-refund:none',
      settlementId:settlement.id,
      clawbackId:clawback.id,
      account:'SUPPLIER_REFUND',
      kind:'CASH',
      amount:1,
      occurredAt:'2026-10-02T00:00:00.000Z',
      actorId:'admin-1',
    }),
    /exceed the outstanding balance/,
  );
  assert.throws(
    ()=>registerChannelRecovery(settlement,billing,[clawback],clawback,[],{
      id:'channel-recovery:none',
      settlementId:settlement.id,
      clawbackId:clawback.id,
      account:'CHANNEL_RECOVERY',
      kind:'CASH',
      amount:1,
      occurredAt:'2026-10-02T00:00:00.000Z',
      actorId:'admin-1',
    }),
    /exceed the outstanding balance/,
  );
});

test('AFTER_FULL_COLLECTION payout is blocked while supplier refund is still due',()=>{
  const ledger=[collection(1_000_000)];
  assert.throws(
    ()=>registerPayout(
      settlement,billing,ledger,payout(1,'payout:blocked'),
      'AFTER_FULL_COLLECTION',[clawback],
    ),
    /blocked until collection is complete/,
  );

  const refunded=registerSupplierRefund(
    settlement,billing,[clawback],clawback,ledger,{
      id:'supplier-refund:all',
      settlementId:settlement.id,
      clawbackId:clawback.id,
      account:'SUPPLIER_REFUND',
      kind:'CASH',
      amount:500_000,
      occurredAt:'2026-10-02T00:00:00.000Z',
      actorId:'admin-1',
    },
  );
  const paid=registerPayout(
    settlement,billing,refunded,payout(400_000,'payout:net'),
    'AFTER_FULL_COLLECTION',[clawback],
  );
  assert.equal(getSettlementNetBalance(settlement,billing,paid,[clawback]).payoutOutstanding,0);
});

test('clawback cash reversal must retain clawback identity and restores outstanding',()=>{
  let ledger:LedgerEntry[]=[collection(1_000_000)];
  ledger=registerSupplierRefund(
    settlement,billing,[clawback],clawback,ledger,{
      id:'supplier-refund:1',
      settlementId:settlement.id,
      clawbackId:clawback.id,
      account:'SUPPLIER_REFUND',
      kind:'CASH',
      amount:500_000,
      occurredAt:'2026-10-02T00:00:00.000Z',
      actorId:'admin-1',
    },
  );

  assert.throws(()=>reverseLedgerEntry(settlement,ledger,{
    id:'reversal:bad',
    settlementId:settlement.id,
    account:'SUPPLIER_REFUND',
    kind:'REVERSAL',
    amount:500_000,
    occurredAt:'2026-10-03T00:00:00.000Z',
    actorId:'admin-1',
    reversalOfEntryId:'supplier-refund:1',
  }),/clawback identity/);

  const reversed=reverseLedgerEntry(settlement,ledger,{
    id:'reversal:refund',
    settlementId:settlement.id,
    clawbackId:clawback.id,
    account:'SUPPLIER_REFUND',
    kind:'REVERSAL',
    amount:500_000,
    occurredAt:'2026-10-03T00:00:00.000Z',
    actorId:'admin-1',
    reversalOfEntryId:'supplier-refund:1',
  });
  assert.equal(
    getSettlementNetBalance(settlement,billing,reversed,[clawback]).supplierRefundOutstanding,
    500_000,
  );
});
