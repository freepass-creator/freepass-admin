/**
 * **상품 원자 → 차종마스터 노드.**  확정된 가장 깊은 곳까지만 (AGENTS §6).
 *
 * ★대표 2026-09-18 「매칭 안되는게 좀 있는데」 — 실측: 목록 687대 중 210대가 UNMATCHED 였는데,
 *   그 판정은 원자의 `ssot_hold_reasons` («freepasserp3 에서 옮겨 온» 옛 표시)를 그대로 믿은 것이었다.
 *   「세부모델 K8 · 싼타페 MX5 · EV6 · GV80 이 차종마스터에 없다」 — 지금 ERP5 `vehicle_master` 에는 다 있다.
 *   ⇒ 옛 표시를 믿지 않고 «지금의 마스터» 에 대어 다시 판정한다.
 * ★반대쪽 구멍도 막는다 — 전에는 공급사가 트림 글자를 적기만 하면 TRIM(확정)으로 올렸다.
 *   마스터의 트림 목록에 있을 때만 TRIM 이다. 글자가 있다고 확정이 아니다.
 *
 * 가르는 법 (지어내지 않는다 — 같은 말일 때만 붙인다)
 *   제조사+모델이 마스터에 있다          → MODEL
 *   + 세부모델이 이름 또는 별칭과 같다   → SUB_MODEL (노드 하나로 좁혀질 때만)
 *   + 트림이 그 노드의 트림 목록에 있다  → TRIM
 *   ⚠ 같은 이름 노드가 둘 이상이면 연식으로 좁힌다. 그래도 둘이면 MODEL 에 멈춘다(고르지 않는다).
 */
import type { VehicleMatchLevel } from './types';

export interface VehicleMasterNode {
  id: string;
  maker: string;
  model: string;
  subModel: string;
  aliases: string[];
  trims: string[];         // 노드 trims ∪ variants[].trims
  yearStart: number | null;
  yearEnd: number | null;  // null = 현재
}

export interface MasterMatch {
  level: VehicleMatchLevel;
  nodeId: string;
  /** 왜 여기서 멈췄나 — 사람이 마스터를 고칠 때 이게 필요하다 */
  why: string | null;
}

/** 견줄 때만 — 띄어쓰기·대소문자·괄호 앞뒤 공백을 없앤다. ★뜻을 바꾸는 가공은 안 한다 */
export const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

export type MasterIndex = Map<string, VehicleMasterNode[]>;   // key = norm(maker)|norm(model)

export function indexMaster(nodes: readonly VehicleMasterNode[]): MasterIndex {
  const m: MasterIndex = new Map();
  for (const n of nodes) {
    const k = `${norm(n.maker)}|${norm(n.model)}`;
    m.set(k, [...(m.get(k) ?? []), n]);
  }
  return m;
}

export function matchToMaster(
  a: { maker?: string; model?: string; subModel?: string; trim?: string; year?: number },
  index: MasterIndex,
): MasterMatch {
  if (!a.maker || !a.model) return { level: 'UNMATCHED', nodeId: '', why: '제조사·모델이 비어 있다' };
  const family = index.get(`${norm(a.maker)}|${norm(a.model)}`);
  if (!family?.length) return { level: 'UNMATCHED', nodeId: '', why: `「${a.maker} ${a.model}」 이 차종마스터에 없다` };
  const modelNode = `${a.maker}|${a.model}`;

  if (!a.subModel) return { level: 'MODEL', nodeId: modelNode, why: '세부모델이 안 적혀 있다' };
  const want = norm(a.subModel);
  let hits = family.filter((n) => norm(n.subModel) === want || n.aliases.some((x) => norm(x) === want));
  if (hits.length > 1 && a.year) {
    const y = a.year;
    const inYear = hits.filter((n) => (n.yearStart === null || n.yearStart <= y) && (n.yearEnd === null || y <= n.yearEnd));
    if (inYear.length) hits = inYear;
  }
  if (!hits.length) return { level: 'MODEL', nodeId: modelNode, why: `세부모델 「${a.subModel}」 이 마스터의 ${a.model} 아래에 없다` };
  if (hits.length > 1) return { level: 'MODEL', nodeId: modelNode, why: `세부모델 「${a.subModel}」 이 마스터에 ${hits.length}곳 — 하나로 못 좁힌다` };

  const node = hits[0];
  if (!a.trim) return { level: 'SUB_MODEL', nodeId: node.id, why: '트림이 안 적혀 있다' };
  if (node.trims.some((t) => norm(t) === norm(a.trim))) return { level: 'TRIM', nodeId: node.id, why: null };
  return { level: 'SUB_MODEL', nodeId: node.id, why: `트림 「${a.trim}」 이 ${node.subModel} 의 트림 목록에 없다` };
}

/**
 * 단계의 «이름» — 화면이 따로 지어 부르지 않게 여기서 정한다(어느 화면이든 같은 말).
 * ★색·모양은 정하지 않는다. `done` 은 「사람이 더 볼 게 없다」 는 뜻만 준다.
 */
export const MATCH_LABEL: Record<VehicleMatchLevel, { label: string; done: boolean }> = {
  TRIM: { label: '트림까지 확정', done: true },
  SUB_MODEL: { label: '세부모델까지', done: false },
  MODEL: { label: '모델까지', done: false },
  UNMATCHED: { label: '차종 미확인', done: false },
};
