import { ERP5_PROJECT_ID, erp5Ready } from '../adapters/erp5/firestore';
import { writeEnabled } from '../adapters/erp5/settlement-repository';
import { contracts, productList, settlements } from './erp5';

export type DataProbe = {
  key: 'products' | 'intakes' | 'clawbacks' | 'contracts';
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
  const credential = erp5Ready();
  const probes = await Promise.all([
    probe('products', '상품', async () => (await productList()).rows),
    probe('intakes', '접수·정산원장', async () => (await settlements.list()).map((x) => x.row)),
    probe('clawbacks', '환수', () => settlements.clawbacks()),
    probe('contracts', '전자계약', () => contracts.list()),
  ]);
  return {
    schema: 'freepass-admin-data-runtime/v1',
    project: ERP5_PROJECT_ID,
    credential,
    writeEnabled: writeEnabled(),
    live: probes.every((x) => x.ok),
    probes,
    checkedAt: new Date().toISOString(),
  };
}
