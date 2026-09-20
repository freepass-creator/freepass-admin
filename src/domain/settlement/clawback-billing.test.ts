import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createClawbackBillingAdjustment,
  createSettlementClawback,
  recordClawbackBillingInvoiceEvidence,
} from './settlement';
import type { SettlementItem } from './types';

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

const clawback=createSettlementClawback(settlement,[],{
  id:'clawback:1',
  supplierAmount:500_000,
  reason:'유지조건 미충족',
  occurredAt:'2026-10-05T00:00:00.000Z',
  createdAt:'2026-10-05T00:01:00.000Z',
  createdBy:'admin-1',
});

test('clawback billing is a separate CREDIT record and never mutates original settlement',()=>{
  const before=structuredClone(settlement);
  const adjustment=createClawbackBillingAdjustment(
    settlement,
    clawback,
    '2026-10-05T00:02:00.000Z',
  );

  assert.equal(adjustment.direction,'CREDIT');
  assert.equal(adjustment.settlementAmount,500_000);
  assert.equal(adjustment.netAmount,500_000);
  assert.equal(adjustment.vatAmount,50_000);
  assert.equal(adjustment.totalAmount,550_000);
  assert.equal(adjustment.status,'CREATED');
  assert.equal(adjustment.occurredAt,'2026-10-05T00:00:00.000Z');
  assert.deepEqual(settlement,before);
});

test('clawback billing evidence completes independently and exact replay is idempotent',()=>{
  const adjustment=createClawbackBillingAdjustment(
    settlement,
    clawback,
    '2026-10-05T00:02:00.000Z',
  );
  const evidence={
    reference:'CREDIT-INV-001',
    issuedAt:'2026-10-05',
    recordedAt:'2026-10-05T00:03:00.000Z',
    recordedBy:'admin-1',
    note:'환수 조정',
  };
  const completed=recordClawbackBillingInvoiceEvidence(adjustment,evidence);
  assert.equal(completed.status,'EVIDENCE_COMPLETE');
  assert.equal(completed.invoiceEvidence?.reference,'CREDIT-INV-001');

  assert.deepEqual(
    recordClawbackBillingInvoiceEvidence(completed,evidence),
    completed,
  );
  assert.throws(
    ()=>recordClawbackBillingInvoiceEvidence(completed,{
      ...evidence,
      reference:'OTHER',
    }),
    /CLAWBACK_BILLING_EVIDENCE_ALREADY_RECORDED/,
  );
});
