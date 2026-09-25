import {
  FREEPASS_DATA_PROJECT_ID,
  contracts,
  freePassDataReady,
  freePassDataWriteEnabled,
  products,
  settlements,
} from './freepass-data';
import { esign } from './esign';

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

/** 관리자 실제 데이터 runtime 상태. 값을 만들거나 보정하지 않고 각 실제 repository를 그대로 읽는다. */
export async function adminDataStatus() {
  const credential = freePassDataReady();
  const esignFinalization = esign.finalizationReadiness();
  const probes = await Promise.all([
    probe('products', '상품', () => products.list()),
    probe('intakes', '접수·정산원장', async () => (await settlements.list()).map((x) => x.row)),
    probe('clawbacks', '환수', () => settlements.clawbacks()),
    probe('cashEvents', '수금·지급 거래', () => settlements.cashEvents()),
    probe('contracts', '전자계약', () => contracts.list()),
  ]);
  return {
    schema: 'freepass-data-runtime/v1',
    project: FREEPASS_DATA_PROJECT_ID,
    credential,
    writeEnabled: freePassDataWriteEnabled(),
    live: probes.every((x) => x.ok),
    esignFinalization,
    probes,
    checkedAt: new Date().toISOString(),
  };
}
