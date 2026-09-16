import type {
  CanonicalProduct,
  Offer,
  PolicyValue,
  VehicleMasterRef,
} from '../../product/types';

export function vehicle(partial: Partial<VehicleMasterRef> = {}): VehicleMasterRef {
  return {
    nodeId: 'node-sonata',
    originId: 'origin-kr',
    manufacturerId: 'mfr-hyundai',
    modelId: 'model-sonata',
    matchLevel: 'MODEL',
    ...partial,
  };
}

export function offer(partial: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-36',
    termMonths: 36,
    monthlyRent: 690_000,
    deposit: 0,
    annualMileageKm: 20_000,
    policyValues: [],
    ...partial,
  };
}

export function product(partial: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    id: 'product-1',
    supplierId: 'supplier-a',
    supplierProductKey: 'A-0001',
    vehicle: vehicle(),
    specs: {},
    offers: [offer()],
    productPolicies: [],
    sourceSnapshotId: 'snap-1',
    updatedAt: '2026-09-16T00:00:00.000Z',
    ...partial,
  };
}

export function policy(
  policyId: string,
  type: PolicyValue['type'],
  value: PolicyValue['value'],
): PolicyValue {
  return { policyId, type, value } as PolicyValue;
}
