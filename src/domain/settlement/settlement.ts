import { markPerformanceFinalized } from '../performance/performance';
import type { Performance } from '../performance/types';
import type {
  BillingRecord,
  BillingInvoiceEvidence,
  ClawbackItem,
  ClawbackMoneyImpact,
  ClawbackSummary,
  LedgerEntry,
  PayoutPolicy,
  SettlementBalance,
  SettlementItem,
} from './types';

function money(value: number | null, label: string): number {
  if (value === null || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} is not ready.`);
  }
  return value;
}

export function createSettlementFromPerformance(
  performance: Performance,
  now: string,
): { performance: Performance; settlement: SettlementItem } {
  if (performance.status !== 'READY_TO_FINALIZE') {
    throw new Error('Performance review is not complete.');
  }
  if (performance.amounts.vatMode === 'UNDECIDED') throw new Error('VAT mode is not decided.');

  const supplierReceivable = money(performance.amounts.supplierReceivable, 'Supplier receivable');
  const channelPayable = money(performance.amounts.channelPayable, 'Channel payable');

  return {
    performance: markPerformanceFinalized(performance, now),
    settlement: {
      id: `settlement:${performance.id}`,
      performanceId: performance.id,
      applicationId: performance.applicationId,
      applicationNumber: performance.snapshot.applicationNumber,
      applicantName: performance.snapshot.applicantName,
      supplierId: performance.snapshot.supplierId,
      salesChannelId: performance.snapshot.salesChannelId,
      assigneeId: performance.snapshot.assigneeId,
      supplierReceivable,
      channelPayable,
      margin: supplierReceivable - channelPayable,
      vatMode: performance.amounts.vatMode,
      ...(performance.pricingEvidence ? { pricingEvidence: { ...performance.pricingEvidence } } : {}),
      createdAt: now,
    },
  };
}

export function createBilling(settlement: SettlementItem, now: string): BillingRecord {
  return {
    id: `billing:${settlement.id}`,
    settlementId: settlement.id,
    supplierId: settlement.supplierId,
    amount: settlement.supplierReceivable,
    status: 'CREATED',
    createdAt: now,
  };
}

export function recordBillingInvoiceEvidence(
  billing: BillingRecord,
  evidence: BillingInvoiceEvidence,
): BillingRecord {
  const reference = evidence.reference.trim();
  const recordedBy = evidence.recordedBy.trim();
  const note = evidence.note?.trim();

  if (!reference) throw new Error('Billing invoice evidence reference is required.');
  if (!recordedBy) throw new Error('Billing invoice evidence recorder is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.issuedAt) || Number.isNaN(Date.parse(evidence.issuedAt + 'T00:00:00Z'))) {
    throw new Error('Billing invoice issuedAt must be YYYY-MM-DD.');
  }
  if (Number.isNaN(Date.parse(evidence.recordedAt))) {
    throw new Error('Billing invoice recordedAt must be an ISO date-time.');
  }

  const normalized: BillingInvoiceEvidence = {
    reference,
    issuedAt: evidence.issuedAt,
    recordedAt: evidence.recordedAt,
    recordedBy,
    ...(note ? { note } : {}),
  };

  if (billing.status === 'EVIDENCE_COMPLETE') {
    if (JSON.stringify(billing.invoiceEvidence) === JSON.stringify(normalized)) return billing;
    throw new Error('BILLING_EVIDENCE_ALREADY_RECORDED');
  }

  return {
    ...billing,
    status: 'EVIDENCE_COMPLETE',
    invoiceEvidence: normalized,
  };
}

function sum(entries: LedgerEntry[], account: LedgerEntry['account']): number {
  const cash = entries
    .filter((entry) => entry.account === account && entry.kind === 'CASH')
    .reduce((total, entry) => total + entry.amount, 0);
  const reversed = entries
    .filter((entry) => entry.account === account && entry.kind === 'REVERSAL')
    .reduce((total, entry) => total + entry.amount, 0);
  return cash - reversed;
}

export function getSettlementBalance(
  settlement: SettlementItem,
  billing: BillingRecord | undefined,
  entries: LedgerEntry[],
): SettlementBalance {
  const relevant = entries.filter((entry) => entry.settlementId === settlement.id);
  const collected = sum(relevant, 'SUPPLIER_COLLECTION');
  const paid = sum(relevant, 'CHANNEL_PAYOUT');
  const billed = billing?.amount ?? 0;
  return {
    confirmedReceivable: settlement.supplierReceivable,
    billed,
    collected,
    collectionOutstanding: billed - collected,
    payable: settlement.channelPayable,
    paid,
    payoutOutstanding: settlement.channelPayable - paid,
    margin: settlement.margin,
  };
}

function assertAmount(amount: number, outstanding: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Ledger amount must be a positive integer.');
  if (amount > outstanding) throw new Error('Ledger amount cannot exceed the outstanding balance.');
}

function appendIdempotently(entries: LedgerEntry[], entry: LedgerEntry): LedgerEntry[] {
  const existing = entries.find((candidate) => candidate.id === entry.id);
  if (!existing) return [...entries, { ...entry }];
  if (JSON.stringify(existing) !== JSON.stringify(entry)) throw new Error('IDEMPOTENCY_KEY_REUSE');
  return entries;
}

export function registerCollection(
  settlement: SettlementItem,
  billing: BillingRecord | undefined,
  entries: LedgerEntry[],
  entry: LedgerEntry,
): LedgerEntry[] {
  if (!billing || billing.settlementId !== settlement.id) throw new Error('Billing must be created first.');
  if (billing.status !== 'EVIDENCE_COMPLETE') throw new Error('Billing invoice evidence must be complete before collection.');
  if (entry.settlementId !== settlement.id || entry.account !== 'SUPPLIER_COLLECTION' || entry.kind !== 'CASH') {
    throw new Error('Invalid collection entry.');
  }
  if (entries.some((candidate) => candidate.id === entry.id)) return appendIdempotently(entries, entry);
  assertAmount(entry.amount, getSettlementBalance(settlement, billing, entries).collectionOutstanding);
  return appendIdempotently(entries, entry);
}

export function registerPayout(
  settlement: SettlementItem,
  billing: BillingRecord | undefined,
  entries: LedgerEntry[],
  entry: LedgerEntry,
  policy: PayoutPolicy,
): LedgerEntry[] {
  if (entry.settlementId !== settlement.id || entry.account !== 'CHANNEL_PAYOUT' || entry.kind !== 'CASH') {
    throw new Error('Invalid payout entry.');
  }
  if (entries.some((candidate) => candidate.id === entry.id)) return appendIdempotently(entries, entry);

  const balance = getSettlementBalance(settlement, billing, entries);
  if (policy === 'AFTER_FULL_COLLECTION' && (!billing || balance.collectionOutstanding > 0)) {
    throw new Error('Payout is blocked until collection is complete.');
  }
  assertAmount(entry.amount, balance.payoutOutstanding);
  return appendIdempotently(entries, entry);
}

export function reverseLedgerEntry(
  settlement: SettlementItem,
  entries: LedgerEntry[],
  reversal: LedgerEntry,
  payoutPolicy: PayoutPolicy = 'AFTER_FULL_COLLECTION',
): LedgerEntry[] {
  if (
    reversal.settlementId !== settlement.id
    || reversal.kind !== 'REVERSAL'
    || !reversal.reversalOfEntryId
  ) {
    throw new Error('Invalid reversal entry.');
  }

  const original = entries.find((entry) => entry.id === reversal.reversalOfEntryId);
  if (
    !original
    || original.settlementId !== settlement.id
    || original.kind !== 'CASH'
    || original.account !== reversal.account
  ) {
    throw new Error('Original ledger entry was not found.');
  }
  if (reversal.amount !== original.amount) throw new Error('Reversal amount must match the original entry.');

  if (payoutPolicy === 'AFTER_FULL_COLLECTION' && original.account === 'SUPPLIER_COLLECTION') {
    const reversed = new Set(
      entries
        .filter((entry) => entry.kind === 'REVERSAL' && entry.reversalOfEntryId)
        .map((entry) => entry.reversalOfEntryId),
    );
    const activePayoutExists = entries.some(
      (entry) => entry.kind === 'CASH'
        && entry.account === 'CHANNEL_PAYOUT'
        && !reversed.has(entry.id),
    );
    if (activePayoutExists) {
      throw new Error('Reverse channel payout entries before reversing supplier collection.');
    }
  }

  if (entries.some((entry) => entry.kind === 'REVERSAL' && entry.reversalOfEntryId === original.id)) {
    throw new Error('Ledger entry is already reversed.');
  }
  return appendIdempotently(entries, reversal);
}


const VAT_RATE=0.1;

function clawbackImpact(
  amount:number,
  vatMode:SettlementItem['vatMode'],
):ClawbackMoneyImpact{
  if(!Number.isSafeInteger(amount)||amount<=0){
    throw new Error('Clawback amount must be a positive integer.');
  }
  if(vatMode==='INCLUDED'){
    const net=Math.round(amount/(1+VAT_RATE));
    return{net,vat:amount-net,total:amount};
  }
  const vat=Math.round(amount*VAT_RATE);
  return{net:amount,vat,total:amount+vat};
}

export function getClawbackSummary(
  settlement:SettlementItem,
  clawbacks:ClawbackItem[],
):ClawbackSummary{
  const relevant=clawbacks.filter((item)=>item.settlementId===settlement.id);
  const supplierClawback=relevant.reduce((sum,item)=>sum+item.supplierAmount,0);
  const channelClawback=relevant.reduce((sum,item)=>sum+item.channelAmount,0);
  return{
    supplierClawback,
    channelClawback,
    supplierRemainingClawbackable:Math.max(0,settlement.supplierReceivable-supplierClawback),
    channelRemainingClawbackable:Math.max(0,settlement.channelPayable-channelClawback),
  };
}

export function createSettlementClawback(
  settlement:SettlementItem,
  existing:ClawbackItem[],
  input:{
    id:string;
    supplierAmount:number;
    channelAmount?:number;
    reason:string;
    occurredAt:string;
    createdAt:string;
    createdBy:string;
  },
):ClawbackItem{
  const id=input.id.trim();
  const reason=input.reason.trim();
  const createdBy=input.createdBy.trim();
  if(!id)throw new Error('Clawback id is required.');
  if(!reason)throw new Error('Clawback reason is required.');
  if(!createdBy)throw new Error('Clawback actor is required.');
  if(Number.isNaN(Date.parse(input.occurredAt)))throw new Error('Clawback occurredAt must be an ISO date-time.');
  if(Number.isNaN(Date.parse(input.createdAt)))throw new Error('Clawback createdAt must be an ISO date-time.');

  const existingById=existing.find((item)=>item.id===id);
  const otherClawbacks=existing.filter((item)=>item.id!==id);
  const summary=getClawbackSummary(settlement,otherClawbacks);

  if(!Number.isSafeInteger(input.supplierAmount)||input.supplierAmount<=0){
    throw new Error('Supplier clawback amount must be a positive integer.');
  }
  if(input.supplierAmount>summary.supplierRemainingClawbackable){
    throw new Error('Supplier clawback exceeds the remaining settlement amount.');
  }

  let channelAmount:number;
  if(input.channelAmount!==undefined){
    if(!Number.isSafeInteger(input.channelAmount)||input.channelAmount<0){
      throw new Error('Channel clawback amount must be a non-negative integer.');
    }
    channelAmount=input.channelAmount;
  }else{
    const ratio=settlement.supplierReceivable>0
      ?settlement.channelPayable/settlement.supplierReceivable
      :0;
    channelAmount=Math.round(input.supplierAmount*ratio);
  }
  if(channelAmount>summary.channelRemainingClawbackable){
    throw new Error('Channel clawback exceeds the remaining settlement amount.');
  }

  const built:ClawbackItem={
    id,
    settlementId:settlement.id,
    performanceId:settlement.performanceId,
    applicationId:settlement.applicationId,
    supplierAmount:input.supplierAmount,
    channelAmount,
    vatMode:settlement.vatMode,
    supplierImpact:clawbackImpact(input.supplierAmount,settlement.vatMode),
    channelImpact:channelAmount>0
      ?clawbackImpact(channelAmount,settlement.vatMode)
      :{net:0,vat:0,total:0},
    reason,
    occurredAt:input.occurredAt,
    createdAt:input.createdAt,
    createdBy,
  };

  if(existingById){
    if(JSON.stringify(existingById)===JSON.stringify(built))return existingById;
    throw new Error('IDEMPOTENCY_KEY_REUSE');
  }
  return built;
}
