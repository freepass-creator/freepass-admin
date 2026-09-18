import { erp5 } from './firestore';
import { indexMaster, type MasterIndex, type VehicleMasterNode } from '../../domain/product/master-match';
import { strOf as S } from './atom.js';

/** ERP5 `vehicle_master` 문서 → 노드. `variants` 는 JSON 글자로 들어 있다(실측). */
export function nodeFromErp5(id: string, d: Record<string, unknown>): VehicleMasterNode {
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

/**
 * ERP5 차종마스터 전부 — 1,816건(실측). 상품 목록을 읽을 때 한 번 같이 읽는다.
 * ★상품 상세 하나만 볼 때(product-repository.ts get())도 이 함수가 매번 «따로» 불렸었다 —
 *   1대를 보려고 1,816건을 통째로 다시 읽는 낭비였다. 차종마스터는 상품·가격보다 훨씬 느리게 바뀌는
 *   자료라(공급사 매물처럼 시간마다 바뀌지 않는다) 5분을 들고 있어도 안전하다.
 *   ★`globalThis` 에 둔다 — `server/erp5.ts` 의 productList 캐시와 같은 자리·같은 이유(Next 가 모듈을
 *   여러 번 평가할 수 있어도 globalThis 는 프로세스에 하나다).
 */
const CACHE_MS = 5 * 60_000;
const g = globalThis as unknown as { __fpaMasterIndex?: { at: number; index: MasterIndex } };

export async function loadMasterIndex(): Promise<MasterIndex> {
  const hit = g.__fpaMasterIndex;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.index;
  const snap = await erp5().collection('vehicle_master').get();
  const index = indexMaster(snap.docs.map((d) => nodeFromErp5(d.id, d.data())));
  g.__fpaMasterIndex = { at: Date.now(), index };
  return index;
}
