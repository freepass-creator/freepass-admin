import { join } from 'node:path';
import type { Performance } from '../../domain/performance/types';
import type { BillingRecord, LedgerEntry, SettlementItem } from '../../domain/settlement/types';
import type { OperationsRepository } from '../../ports/operations';
import { JsonFileStore } from './json-file-store';

type OperationsState = {
  schemaVersion: 1;
  performances: Performance[];
  settlements: SettlementItem[];
  billings: BillingRecord[];
  ledger: LedgerEntry[];
};

const DATA_DIR = process.env.FPA_DATA_DIR ?? join(process.cwd(), '.data');

function emptyState(): OperationsState {
  return { schemaVersion: 1, performances: [], settlements: [], billings: [], ledger: [] };
}

export class FileOperationsRepository implements OperationsRepository {
  private readonly store: JsonFileStore<OperationsState>;

  constructor(dir: string = DATA_DIR) {
    this.store = new JsonFileStore<OperationsState>(dir, 'operations');
  }

  private async read(): Promise<OperationsState> {
    const rows = await this.store.all();
    return rows[0] ? structuredClone(rows[0]) : emptyState();
  }

  private async mutate<R>(fn: (state: OperationsState) => R): Promise<R> {
    return this.store.mutate((rows) => {
      const state = rows[0] ? structuredClone(rows[0]) : emptyState();
      const result = fn(state);
      return { rows: [state], result };
    });
  }

  async ensurePerformance(candidate: Performance) {
    return this.mutate((state) => {
      const existing = state.performances.find((x) => x.applicationId === candidate.applicationId);
      if (existing) return { performance: structuredClone(existing), created: false };
      state.performances.push(structuredClone(candidate));
      return { performance: structuredClone(candidate), created: true };
    });
  }

  async getPerformance(id: string) {
    return (await this.read()).performances.find((x) => x.id === id) ?? null;
  }

  async listPerformances() {
    return (await this.read()).performances
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async mutatePerformance(id: string, change: (current: Performance) => Performance) {
    return this.mutate((state) => {
      const index = state.performances.findIndex((x) => x.id === id);
      if (index < 0) throw new Error('PERFORMANCE_NOT_FOUND');
      const next = change(structuredClone(state.performances[index]));
      if (next.id !== state.performances[index].id || next.applicationId !== state.performances[index].applicationId) {
        throw new Error('PERFORMANCE_IDENTITY_IMMUTABLE');
      }
      state.performances[index] = structuredClone(next);
      return structuredClone(next);
    });
  }

  async finalizePerformance(
    id: string,
    finalize: (current: Performance) => { performance: Performance; settlement: SettlementItem },
  ) {
    return this.mutate((state) => {
      const index = state.performances.findIndex((x) => x.id === id);
      if (index < 0) throw new Error('PERFORMANCE_NOT_FOUND');

      const existingSettlement = state.settlements.find((x) => x.performanceId === id);
      if (existingSettlement) {
        return {
          performance: structuredClone(state.performances[index]),
          settlement: structuredClone(existingSettlement),
          created: false,
        };
      }

      const built = finalize(structuredClone(state.performances[index]));
      if (built.settlement.performanceId !== id || built.performance.id !== id) {
        throw new Error('SETTLEMENT_PERFORMANCE_IDENTITY_MISMATCH');
      }
      state.performances[index] = structuredClone(built.performance);
      state.settlements.push(structuredClone(built.settlement));
      return {
        performance: structuredClone(built.performance),
        settlement: structuredClone(built.settlement),
        created: true,
      };
    });
  }

  async getSettlement(id: string) {
    return (await this.read()).settlements.find((x) => x.id === id) ?? null;
  }

  async findSettlementByPerformanceId(performanceId: string) {
    return (await this.read()).settlements.find((x) => x.performanceId === performanceId) ?? null;
  }

  async listSettlements() {
    return (await this.read()).settlements
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async ensureBilling(settlementId: string, create: () => BillingRecord) {
    return this.mutate((state) => {
      const existing = state.billings.find((x) => x.settlementId === settlementId);
      if (existing) return { billing: structuredClone(existing), created: false };
      if (!state.settlements.some((x) => x.id === settlementId)) throw new Error('SETTLEMENT_NOT_FOUND');
      const billing = create();
      if (billing.settlementId !== settlementId) throw new Error('BILLING_SETTLEMENT_IDENTITY_MISMATCH');
      state.billings.push(structuredClone(billing));
      return { billing: structuredClone(billing), created: true };
    });
  }

  async getBillingBySettlementId(settlementId: string) {
    return (await this.read()).billings.find((x) => x.settlementId === settlementId) ?? null;
  }

  async listLedger(settlementId: string) {
    return (await this.read()).ledger
      .filter((x) => x.settlementId === settlementId)
      .slice()
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  async mutateLedger(settlementId: string, change: (entries: LedgerEntry[]) => LedgerEntry[]) {
    return this.mutate((state) => {
      if (!state.settlements.some((x) => x.id === settlementId)) throw new Error('SETTLEMENT_NOT_FOUND');
      const other = state.ledger.filter((x) => x.settlementId !== settlementId);
      const current = state.ledger.filter((x) => x.settlementId === settlementId);
      const next = change(structuredClone(current));
      if (next.some((x) => x.settlementId !== settlementId)) throw new Error('LEDGER_SETTLEMENT_IDENTITY_MISMATCH');
      state.ledger = [...other, ...structuredClone(next)];
      return structuredClone(next);
    });
  }
}
