import type { CanonicalProduct, Offer, PolicyValue } from '../product/types';

/** 차종 축 — 원산지 → 제조사 → 모델 → 세부모델 → 세부트림 (AGENTS.md §6) */
export type VehicleAxis = 'ORIGIN' | 'MANUFACTURER' | 'MODEL' | 'SUB_MODEL' | 'TRIM';

/** 수치 범위. 양끝 모두 포함(inclusive). 값이 비어 있는 필드는 만족하지 않는다 (S-08). */
export interface NumericRange {
  min?: number;
  max?: number;
}

/** 한 정책에 대한 요구. `anyOf` 안은 OR (S-01, S-11). */
export interface PolicyRequirement {
  policyId: string;
  anyOf: PolicyValue['value'][];
}

/**
 * 검색 질의. 같은 축의 복수값은 OR, 서로 다른 축은 AND (S-01).
 * Offer 축(termMonths 이하)은 하나의 Offer 가 동시에 만족해야 한다 (S-02).
 */
export interface ProductSearchQuery {
  supplierIds?: string[];
  productKinds?: string[];
  credits?: string[];

  originIds?: string[];
  manufacturerIds?: string[];
  modelIds?: string[];
  subModelIds?: string[];
  trimIds?: string[];

  modelYears?: number[];
  fuels?: string[];
  /** 차량 자체의 현재 누적 주행거리. Offer의 annualMileageKm와 다른 축이다. */
  vehicleMileageKm?: NumericRange;

  termMonths?: number[];
  monthlyRent?: NumericRange;
  deposit?: NumericRange;
  annualMileageKm?: NumericRange;
  policies?: PolicyRequirement[];
}

/**
 * 차종 매칭 결과.
 * `PARTIAL` = 상품의 확정 깊이보다 깊은 것을 물었다 (S-06). 확정처럼 꾸미지 않는다.
 */
export interface VehicleMatchResult {
  level: 'EXACT' | 'PARTIAL';
  unconfirmedAxes: VehicleAxis[];
}

export interface ProductSearchMatch {
  product: CanonicalProduct;
  /** 조건을 만족한 Offer. 상세·접수는 여기서 고른다 (S-03). */
  matchedOffers: Offer[];
  /** 상세·접수까지 그대로 따라가는 id 목록 (S-03). */
  matchedOfferIds: string[];
  vehicleMatch: VehicleMatchResult;
}
