import type { PerformancePricingEvidence, VatMode } from '../performance/types';

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

export interface BillingInvoiceEvidence {
  reference: string;
  issuedAt: string;
  recordedAt: string;
  recordedBy: string;
  note?: string;
}

export interface BillingRecord {
  id: string;
  settlementId: string;
  supplierId: string;
  amount: number;
  status: 'CREATED' | 'EVIDENCE_COMPLETE';
  invoiceEvidence?: BillingInvoiceEvidence;
  createdAt: string;
}

export interface SettlementItem {
  id: string;
  performanceId: string;
  applicationId: string;
  applicationNumber: string;
  applicantName: string;
  supplierId: string;
  salesChannelId: string;
  assigneeId: string;
  supplierReceivable: number;
  channelPayable: number;
  margin: number;
  vatMode: Exclude<VatMode, 'UNDECIDED'>;
  pricingEvidence?: PerformancePricingEvidence;
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
