import type { CanonicalProduct, Offer, PolicyValue } from '../product/types';

export interface ProductSearchQuery {
  modelId?: string;
  subModelId?: string;
  trimId?: string;
  termMonths?: number;
  maxMonthlyRent?: number;
  maxDeposit?: number;
  minAnnualMileageKm?: number;
  policies?: Array<{ policyId: string; value: PolicyValue['value'] }>;
}

export interface ProductSearchMatch {
  product: CanonicalProduct;
  matchedOffers: Offer[];
  vehicleMatch: 'EXACT' | 'PARTIAL';
}

function sameValue(left: PolicyValue['value'], right: PolicyValue['value']) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return right.every((value) => left.includes(value));
  }
  return left === right;
}

function matchesPolicies(values: PolicyValue[], query: ProductSearchQuery['policies']) {
  if (!query?.length) return true;
  return query.every((required) =>
    values.some(
      (actual) => actual.policyId === required.policyId && sameValue(actual.value, required.value),
    ),
  );
}

function matchesOffer(offer: Offer, query: ProductSearchQuery) {
  if (query.termMonths !== undefined && offer.termMonths !== query.termMonths) return false;
  if (query.maxMonthlyRent !== undefined && offer.monthlyRent > query.maxMonthlyRent) return false;
  if (query.maxDeposit !== undefined && (offer.deposit === undefined || offer.deposit > query.maxDeposit)) return false;
  if (
    query.minAnnualMileageKm !== undefined &&
    (offer.annualMileageKm === undefined || offer.annualMileageKm < query.minAnnualMileageKm)
  ) return false;
  return matchesPolicies(offer.policyValues, query.policies);
}

export function matchProduct(
  product: CanonicalProduct,
  query: ProductSearchQuery,
): ProductSearchMatch | null {
  if (query.modelId && product.vehicle.modelId !== query.modelId) return null;

  let vehicleMatch: ProductSearchMatch['vehicleMatch'] = 'EXACT';

  if (query.subModelId) {
    if (product.vehicle.subModelId && product.vehicle.subModelId !== query.subModelId) return null;
    if (!product.vehicle.subModelId) vehicleMatch = 'PARTIAL';
  }

  if (query.trimId) {
    if (product.vehicle.trimId && product.vehicle.trimId !== query.trimId) return null;
    if (!product.vehicle.trimId) vehicleMatch = 'PARTIAL';
  }

  const matchedOffers = product.offers.filter((offer) => matchesOffer(offer, query));
  if (!matchedOffers.length) return null;

  return { product, matchedOffers, vehicleMatch };
}
