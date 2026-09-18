import { erp5 } from './firestore';
import { indexMaster, type MasterIndex, type VehicleMasterNode } from '../../domain/product/master-match';

/** ERP5 `vehicle_master` 문서 → 노드. `variants` 는 JSON 글자로 들어 있다(실측). */
export function nodeFromErp5(id: string, d: Record<string, unknown>): VehicleMasterNode {
  const S = (v: unknown) => String(v ?? '').trim();
  const arr = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim().startsWith('[')) { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } }
    return [];
  };
  const trims = new Set<string>();
  for (const t of arr(d.trims)) if (S(t)) trims.add(S(t));
  for (const v of arr(d.variants)) for (const t of arr((v as Record<string, unknown>)?.trims)) if (S(t)) trims.add(S(t));
  const yr = (v: unknown) => { const n = Number(String(v ?? '').slice(0, 4)); return Number.isFinite(n) && n > 1900 ? n : null; };
  return {
    id, maker: S(d.maker), model: S(d.model), subModel: S(d.sub_model),
    aliases: arr(d.aliases).map(S).filter(Boolean),
    trims: [...trims],
    yearStart: yr(d.year_start), yearEnd: yr(d.year_end),
  };
}

/** ERP5 차종마스터 전부 — 1,816건(실측). 상품 목록을 읽을 때 한 번 같이 읽는다. */
export async function loadMasterIndex(): Promise<MasterIndex> {
  const snap = await erp5().collection('vehicle_master').get();
  return indexMaster(snap.docs.map((d) => nodeFromErp5(d.id, d.data())));
}
