import type { VatMode } from '../performance/types';

export type PayoutPolicy = 'AFTER_FULL_COLLECTION' | 'INDEPENDENT';
export type LedgerAccount = 'SUPPLIER_COLLECTION' | 'CHANNEL_PAYOUT';

export interface LedgerEntry {
  id: string;
  settlementId: string;
  account: LedgerAccount;
  kind: 'CASH' | 'REVERSAL';
  amount: number;
  occurredAt: string;
  actorId: string;
  note?: string;
  reversalOfEntryId?: string;
}

export interface BillingRecord {
  id: string;
  settlementId: string;
  supplierId: string;
  amount: number;
  status: 'CREATED' | 'EVIDENCE_COMPLETE';
  createdAt: string;
}

export interface SettlementItem {
  id: string;
  performanceId: string;
  applicationId: string;
  applicationNumber: string;
  customerName: string;
  supplierId: string;
  salesChannelId: string;
  assigneeId: string;
  supplierReceivable: number;
  channelPayable: number;
  margin: number;
  vatMode: Exclude<VatMode, 'UNDECIDED'>;
  createdAt: string;
}

export interface SettlementBalance {
  confirmedReceivable: number;
  billed: number;
  collected: number;
  collectionOutstanding: number;
  payable: number;
  paid: number;
  payoutOutstanding: number;
  margin: number;
}
