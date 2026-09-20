import type { Performance } from '../domain/performance/types';
import type { BillingRecord, ClawbackBillingAdjustment, ClawbackItem, LedgerEntry, SettlementItem } from '../domain/settlement/types';

export interface OperationsRepository {
  ensurePerformance(candidate: Performance): Promise<{ performance: Performance; created: boolean }>;
  getPerformance(id: string): Promise<Performance | null>;
  listPerformances(): Promise<Performance[]>;
  mutatePerformance(
    id: string,
    change: (current: Performance) => Performance,
  ): Promise<Performance>;

  finalizePerformance(
    id: string,
    finalize: (current: Performance) => { performance: Performance; settlement: SettlementItem },
  ): Promise<{ performance: Performance; settlement: SettlementItem; created: boolean }>;

  getSettlement(id: string): Promise<SettlementItem | null>;
  findSettlementByPerformanceId(performanceId: string): Promise<SettlementItem | null>;
  listSettlements(): Promise<SettlementItem[]>;

  ensureClawback(
    settlementId: string,
    candidate: ClawbackItem,
  ): Promise<{ clawback: ClawbackItem; created: boolean }>;
  listClawbacks(settlementId: string): Promise<ClawbackItem[]>;

  ensureClawbackBilling(
    clawbackId: string,
    create: () => ClawbackBillingAdjustment,
  ): Promise<{ adjustment: ClawbackBillingAdjustment; created: boolean }>;
  getClawbackBillingByClawbackId(clawbackId: string): Promise<ClawbackBillingAdjustment | null>;
  mutateClawbackBilling(
    clawbackId: string,
    change: (current: ClawbackBillingAdjustment) => ClawbackBillingAdjustment,
  ): Promise<ClawbackBillingAdjustment>;

  ensureBilling(
    settlementId: string,
    create: () => BillingRecord,
  ): Promise<{ billing: BillingRecord; created: boolean }>;
  getBillingBySettlementId(settlementId: string): Promise<BillingRecord | null>;
  mutateBilling(
    settlementId: string,
    change: (current: BillingRecord) => BillingRecord,
  ): Promise<BillingRecord>;

  listLedger(settlementId: string): Promise<LedgerEntry[]>;
  mutateLedger(
    settlementId: string,
    change: (entries: LedgerEntry[]) => LedgerEntry[],
  ): Promise<LedgerEntry[]>;
}
