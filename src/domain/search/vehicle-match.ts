import type { VehicleMasterRef, VehicleMatchLevel } from '../product/types';
import type { ProductSearchQuery, VehicleAxis, VehicleMatchResult } from './types';

const AXIS_DEPTH: Record<VehicleAxis, number> = {
  ORIGIN: 1,
  MANUFACTURER: 2,
  MODEL: 3,
  SUB_MODEL: 4,
  TRIM: 5,
};

/** 확정 깊이. UNMATCHED 는 어느 노드도 확정되지 않았다는 뜻이다. */
const LEVEL_DEPTH: Record<VehicleMatchLevel, number> = {
  UNMATCHED: 0,
  MODEL: AXIS_DEPTH.MODEL,
  SUB_MODEL: AXIS_DEPTH.SUB_MODEL,
  TRIM: AXIS_DEPTH.TRIM,
};

const AXIS_FIELD: Record<VehicleAxis, keyof VehicleMasterRef> = {
  ORIGIN: 'originId',
  MANUFACTURER: 'manufacturerId',
  MODEL: 'modelId',
  SUB_MODEL: 'subModelId',
  TRIM: 'trimId',
};

const AXIS_QUERY_FIELD: Record<VehicleAxis, keyof ProductSearchQuery> = {
  ORIGIN: 'originIds',
  MANUFACTURER: 'manufacturerIds',
  MODEL: 'modelIds',
  SUB_MODEL: 'subModelIds',
  TRIM: 'trimIds',
};

const AXES: VehicleAxis[] = ['ORIGIN', 'MANUFACTURER', 'MODEL', 'SUB_MODEL', 'TRIM'];

/**
 * S-04 — `matchLevel` 까지만 확정으로 본다.
 * 데이터에 더 깊은 id 가 남아 있어도 검색은 쓰지 않는다.
 */
export function confirmedVehicleId(
  vehicle: VehicleMasterRef,
  axis: VehicleAxis,
): string | undefined {
  if (AXIS_DEPTH[axis] > LEVEL_DEPTH[vehicle.matchLevel]) return undefined;
  const value = vehicle[AXIS_FIELD[axis]];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requestedIds(query: ProductSearchQuery, axis: VehicleAxis): string[] | undefined {
  const raw = query[AXIS_QUERY_FIELD[axis]];
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw as string[];
}

/**
 * 차종 축 판정. 제외면 `null`.
 *
 * - S-05 확정값이 요청 집합에 없으면 제외
 * - S-06 상품의 확정 깊이보다 깊은 질문이면 PARTIAL(제외하지도, EXACT 로 올리지도 않는다)
 * - S-07 차종 축이 걸린 검색에서 UNMATCHED 는 제외
 */
export function matchVehicle(
  vehicle: VehicleMasterRef,
  query: ProductSearchQuery,
): VehicleMatchResult | null {
  const asked = AXES.filter((axis) => requestedIds(query, axis) !== undefined);
  if (asked.length === 0) return { level: 'EXACT', unconfirmedAxes: [] };

  if (vehicle.matchLevel === 'UNMATCHED') return null;

  const unconfirmedAxes: VehicleAxis[] = [];
  for (const axis of asked) {
    const wanted = requestedIds(query, axis);
    if (!wanted) continue;
    const actual = confirmedVehicleId(vehicle, axis);
    if (actual === undefined) {
      unconfirmedAxes.push(axis);
      continue;
    }
    if (!wanted.includes(actual)) return null;
  }

  return {
    level: unconfirmedAxes.length > 0 ? 'PARTIAL' : 'EXACT',
    unconfirmedAxes,
  };
}
