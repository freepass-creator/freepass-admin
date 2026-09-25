import { resolveOfferPolicies } from '../product/resolve-policies';
import type { CanonicalProduct, Offer, PolicyValue } from '../product/types';
import type {
  NumericRange,
  PolicyRequirement,
  ProductSearchMatch,
  ProductSearchQuery,
} from './types';
import { matchVehicle } from './vehicle-match';

/**
 * S-08 — 미확인 ≠ 0 / 불가 / 무제한.
 * 범위 조건이 걸렸는데 값이 비어 있으면 **만족하지 않는다.**
 * 보증금 공란이 「보증금 0원」 검색에 딸려 들어오는 것을 여기서 막는다.
 */
function inRange(value: number | undefined, range: NumericRange | undefined): boolean {
  if (!range || (range.min === undefined && range.max === undefined)) return true;
  if (typeof value !== 'number' || Number.isNaN(value)) return false;
  if (range.min !== undefined && value < range.min) return false;
  if (range.max !== undefined && value > range.max) return false;
  return true;
}

function multiSelectMatches(actual: readonly string[], requested: PolicyValue['value']): boolean {
  const wanted = Array.isArray(requested) ? requested : [requested];
  return wanted.some((value) => typeof value === 'string' && actual.includes(value));
}

function policyValueMatches(actual: PolicyValue, requested: PolicyValue['value']): boolean {
  if (actual.type === 'MULTI_SELECT') return multiSelectMatches(actual.value, requested);
  if (Array.isArray(requested)) return false;
  return actual.value === requested;
}

/**
 * S-09 — 정책값이 없으면 `true` 요구에도 `false` 요구에도 걸리지 않는다.
 * S-11 — `anyOf` 안은 OR.
 */
function satisfiesPolicy(resolved: PolicyValue[], requirement: PolicyRequirement): boolean {
  if (requirement.anyOf.length === 0) return true;
  const actual = resolved.find((policy) => policy.policyId === requirement.policyId);
  if (!actual) return false;
  return requirement.anyOf.some((requested) => policyValueMatches(actual, requested));
}

/**
 * S-02 — Offer 축 조건은 **이 Offer 하나**가 전부 만족해야 한다.
 * 다른 Offer 의 값을 끌어와 없는 조건을 만들지 않는다.
 */
export function matchOffer(
  product: Pick<CanonicalProduct, 'productPolicies'>,
  offer: Offer,
  query: ProductSearchQuery,
): boolean {
  if (query.termMonths?.length && !query.termMonths.includes(offer.termMonths)) return false;
  if (!inRange(offer.monthlyRent, query.monthlyRent)) return false;
  if (!inRange(offer.deposit, query.deposit)) return false;
  if (!inRange(offer.annualMileageKm, query.annualMileageKm)) return false;

  if (query.policies?.length) {
    const resolved = resolveOfferPolicies(product, offer);
    if (!query.policies.every((requirement) => satisfiesPolicy(resolved, requirement))) return false;
  }

  return true;
}

/**
 * 상품 하나를 판정한다. 조건에 맞지 않으면 `null`.
 * 맞으면 **조건을 만족한 Offer 만** 싣는다 (S-03 — 이 id 가 상세·접수까지 간다).
 */
export function matchProduct(
  product: CanonicalProduct,
  query: ProductSearchQuery,
): ProductSearchMatch | null {
  if (query.supplierIds?.length && !query.supplierIds.includes(product.supplierId)) return null;
  if (query.productKinds?.length && (!product.productKind || !query.productKinds.includes(product.productKind))) return null;
  if (query.credits?.length && (!product.credit || !query.credits.includes(product.credit))) return null;
  if (query.modelYears?.length && (product.specs.modelYear === undefined || !query.modelYears.includes(product.specs.modelYear))) return null;
  if (query.fuels?.length && (!product.specs.fuel || !query.fuels.includes(product.specs.fuel))) return null;
  if (!inRange(product.specs.mileageKm, query.vehicleMileageKm)) return null;

  const vehicleMatch = matchVehicle(product.vehicle, query);
  if (!vehicleMatch) return null;

  // S-13 — 접수로 이어질 계약조건이 없는 상품은 「찾았다」고 하지 않는다.
  const matchedOffers = product.offers.filter((offer) => matchOffer(product, offer, query));
  if (matchedOffers.length === 0) return null;

  return {
    product,
    matchedOffers,
    matchedOfferIds: matchedOffers.map((offer) => offer.id),
    vehicleMatch,
  };
}
