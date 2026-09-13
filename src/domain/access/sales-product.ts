import type { CanonicalProduct, Offer, PolicyValue } from '@/domain/product/types';

export type SalesProductProjection = {
  id: string;
  displayName: string;
  sub: string;
  category: '신차렌트' | '재렌트';
  status: '판매중' | '판매종료';
  vehicleNumber?: string;
  specs: {
    modelYear?: number;
    fuel?: string;
    displacementCc?: number;
    seats?: number;
  };
  offers: Offer[];
  policies: PolicyValue[];
};

type SalesProjectionSource = {
  product: CanonicalProduct;
  sub: string;
  category: SalesProductProjection['category'];
  status: SalesProductProjection['status'];
};

function clonePolicy<T extends PolicyValue>(policy: T): T {
  return {
    ...policy,
    value: Array.isArray(policy.value) ? [...policy.value] : policy.value,
  } as T;
}

export function projectProductForSales(source: SalesProjectionSource): SalesProductProjection {
  return {
    id: source.product.id,
    displayName: source.product.displayName,
    sub: source.sub,
    category: source.category,
    status: source.status,
    vehicleNumber: source.product.registration?.vehicleNumber,
    specs: {
      modelYear: source.product.specs.modelYear,
      fuel: source.product.specs.fuel,
      displacementCc: source.product.specs.displacementCc,
      seats: source.product.specs.seats,
    },
    offers: source.product.offers.map((offer) => ({
      ...offer,
      policyValues: offer.policyValues.map(clonePolicy),
    })),
    policies: source.product.productPolicies.map(clonePolicy),
  };
}
