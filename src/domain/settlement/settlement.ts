import { markPerformanceFinalized } from '../performance/performance';
import type { Performance } from '../performance/types';
import type {
  BillingRecord,
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
  if (entries.some((entry) => entry.kind === 'REVERSAL' && entry.reversalOfEntryId === original.id)) {
    throw new Error('Ledger entry is already reversed.');
  }
  return appendIdempotently(entries, reversal);
}
