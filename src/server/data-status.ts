import { ERP5_PROJECT_ID, erp5Ready, writeGate } from './erp5';
import { esign } from './esign';
import { adminCatalogListFresh, adminCatalogStatus } from './freepass-data';
import { contracts, settlements } from './erp5';

export type DataProbe = {
  key: 'products' | 'intakes' | 'clawbacks' | 'cashEvents' | 'contracts';
  label: string;
  ok: boolean;
  count: number | null;
  error: string | null;
};

async function probe(key: DataProbe['key'], label: string, read: () => Promise<unknown[]>): Promise<DataProbe> {
  try {
    const rows = await read();
    return { key, label, ok: true, count: rows.length, error: null };
  } catch (e) {
    return { key, label, ok: false, count: null, error: (e as Error).message };
  }
}

/**
 * Admin runtime status.
 * Data authority and physical storage are reported separately so the legacy ERP5 bridge
 * can never be mistaken for the FreePass Data public contract.
 */
export async function adminDataStatus() {
  const credential = erp5Ready();
  const gate = writeGate();
  const esignFinalization = esign.finalizationReadiness();
  const probes = await Promise.all([
    probe('products', '상품', async () => (await adminCatalogListFresh()).rows),
    probe('intakes', '접수·정산원장', async () => (await settlements.list()).map((x) => x.row)),
    probe('clawbacks', '환수', () => settlements.clawbacks()),
    probe('cashEvents', '수금·지급 거래', () => settlements.cashEvents()),
    probe('contracts', '전자계약', () => contracts.list()),
  ]);
  const catalog = adminCatalogStatus();
  return {
    schema: 'freepass-admin-data-runtime/v2',
    authority: 'FREEPASS_DATA' as const,
    catalog,
    /** Transitional Admin workflow store and Catalog legacy bridge physical project. */
    project: ERP5_PROJECT_ID,
    credential,
    writeEnabled: gate.enabled,
    writeGate: {
      mode: gate.mode,
      reason: gate.reason,
      approvalRef: gate.approval?.approvalRef ?? null,
      approvedAt: gate.approval?.approvedAt ?? null,
      validUntil: gate.approval?.validUntil ?? null,
    },
    live: probes.every((x) => x.ok),
    esignFinalization,
    probes,
    checkedAt: new Date().toISOString(),
  };
}
