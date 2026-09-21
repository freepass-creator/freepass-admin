import type { CanonicalProduct } from '../../domain/product/types';

/** 차종 이름 — 제조사 모델 세부모델 트림. ★확정된 깊이까지만 (AGENTS §6). */
export const vehicleName = (p: CanonicalProduct) =>
  [p.vehicle.manufacturerId, p.vehicle.modelId, p.vehicle.subModelId, p.vehicle.trimId].filter(Boolean).join(' ');
