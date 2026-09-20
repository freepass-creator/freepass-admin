import type { PerformancePricingEvidence, VatMode } from '../performance/types';

export type PayoutPolicy = 'AFTER_FULL_COLLECTION' | 'INDEPENDENT';
export type LedgerAccount =
  | 'SUPPLIER_COLLECTION'
  | 'CHANNEL_PAYOUT'
  | 'SUPPLIER_REFUND'
  | 'CHANNEL_RECOVERY';

export interface LedgerEntry {
  id: string;
  settlementId: string;
  account: LedgerAccount;
  kind: 'CASH' | 'REVERSAL';
  amount: number;
  occurredAt: string;
  actorId: string;
  note?: string;
  clawbackId?: string;
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


export interface ClawbackMoneyImpact {
  net: number;
  vat: number;
  total: number;
}

export interface ClawbackItem {
  id: string;
  settlementId: string;
  performanceId: string;
  applicationId: string;
  /** Positive magnitude to subtract from the original supplier settlement. */
  supplierAmount: number;
  /** Positive magnitude to recover from the sales channel. */
  channelAmount: number;
  vatMode: Exclude<VatMode, 'UNDECIDED'>;
  supplierImpact: ClawbackMoneyImpact;
  channelImpact: ClawbackMoneyImpact;
  reason: string;
  occurredAt: string;
  createdAt: string;
  createdBy: string;
}

export interface ClawbackSummary {
  supplierClawback: number;
  channelClawback: number;
  supplierRemainingClawbackable: number;
  channelRemainingClawbackable: number;
}


export interface SettlementNetBalance {
  originalReceivable: number;
  supplierClawback: number;
  netReceivable: number;
  collected: number;
  supplierRefunded: number;
  netCollected: number;
  collectionOutstanding: number;
  supplierRefundOutstanding: number;

  originalPayable: number;
  channelClawback: number;
  netPayable: number;
  paid: number;
  channelRecovered: number;
  netPaid: number;
  payoutOutstanding: number;
  channelRecoveryOutstanding: number;

  netMargin: number;
}

export interface ClawbackCashBalance {
  supplierTarget: number;
  supplierRefunded: number;
  supplierRefundRemaining: number;
  channelTarget: number;
  channelRecovered: number;
  channelRecoveryRemaining: number;
}


export interface ClawbackBillingAdjustment {
  id: string;
  settlementId: string;
  clawbackId: string;
  supplierId: string;
  direction: 'CREDIT';
  settlementAmount: number;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  status: 'CREATED' | 'EVIDENCE_COMPLETE';
  invoiceEvidence?: BillingInvoiceEvidence;
  occurredAt: string;
  createdAt: string;
}
