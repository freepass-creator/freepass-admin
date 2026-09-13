import type { CanonicalProduct, Offer, PolicyValue } from '../product/types';

export interface ProductSearchQuery {
  modelId?: string;
  modelIds?: string[];
  subModelId?: string;
  subModelIds?: string[];
  trimId?: string;
  trimIds?: string[];
  termMonths?: number;
  termMonthsAny?: number[];
  maxMonthlyRent?: number;
  maxDeposit?: number;
  minAnnualMileageKm?: number;
  policies?: Array<{ policyId: string; value: PolicyValue['value']; scope?: 'PRODUCT' | 'OFFER' }>;
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

function hasPolicy(values: PolicyValue[], policyId: string, value: PolicyValue['value']) {
  return values.some((actual) => actual.policyId === policyId && sameValue(actual.value, value));
}

function matchesPolicies(productValues: PolicyValue[], offerValues: PolicyValue[], query: ProductSearchQuery['policies']) {
  if (!query?.length) return true;
  return query.every((required) => {
    if (required.scope === 'PRODUCT') return hasPolicy(productValues, required.policyId, required.value);
    if (required.scope === 'OFFER') return hasPolicy(offerValues, required.policyId, required.value);
    return hasPolicy(productValues, required.policyId, required.value) || hasPolicy(offerValues, required.policyId, required.value);
  });
}

function matchesOffer(product: CanonicalProduct, offer: Offer, query: ProductSearchQuery) {
  if (query.termMonths !== undefined && offer.termMonths !== query.termMonths) return false;
  if (query.termMonthsAny?.length && !query.termMonthsAny.includes(offer.termMonths)) return false;
  if (query.maxMonthlyRent !== undefined && offer.monthlyRent > query.maxMonthlyRent) return false;
  if (query.maxDeposit !== undefined && (offer.deposit === undefined || offer.deposit > query.maxDeposit)) return false;
  if (
    query.minAnnualMileageKm !== undefined &&
    (offer.annualMileageKm === undefined || offer.annualMileageKm < query.minAnnualMileageKm)
  ) return false;
  return matchesPolicies(product.productPolicies, offer.policyValues, query.policies);
}

function matchesAny(value: string, single?: string, multiple?: string[]) {
  if (single && value !== single) return false;
  if (multiple?.length && !multiple.includes(value)) return false;
  return true;
}

export function matchProduct(
  product: CanonicalProduct,
  query: ProductSearchQuery,
): ProductSearchMatch | null {
  if (!matchesAny(product.vehicle.modelId, query.modelId, query.modelIds)) return null;

  let vehicleMatch: ProductSearchMatch['vehicleMatch'] = 'EXACT';

  const subModelQuery = query.subModelId ?? (query.subModelIds?.length === 1 ? query.subModelIds[0] : undefined);
  if (query.subModelId || query.subModelIds?.length) {
    if (product.vehicle.subModelId && !matchesAny(product.vehicle.subModelId, query.subModelId, query.subModelIds)) return null;
    if (!product.vehicle.subModelId) vehicleMatch = 'PARTIAL';
  }

  if (query.trimId || query.trimIds?.length) {
    if (product.vehicle.trimId && !matchesAny(product.vehicle.trimId, query.trimId, query.trimIds)) return null;
    if (!product.vehicle.trimId) {
      if (product.vehicle.subModelId && !subModelQuery) return null;
      vehicleMatch = 'PARTIAL';
    }
  }

  const matchedOffers = product.offers.filter((offer) => matchesOffer(product, offer, query));
  if (!matchedOffers.length) return null;

  return { product, matchedOffers, vehicleMatch };
}
