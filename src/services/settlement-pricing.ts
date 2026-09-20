import type { Performance } from '../domain/performance/types';
import type {
  SettlementOperationalFacts,
  SettlementPricingInput,
  SettlementPricingProvider,
  SettlementPricingResult,
} from '../ports/settlement-pricing';

export function settlementPricingInput(
  performance: Performance,
  operational: SettlementOperationalFacts = {},
): SettlementPricingInput {
  const offer=performance.snapshot.offer;
  return {
    performanceId:performance.id,
    applicationId:performance.applicationId,
    catalog:{
      productId:performance.snapshot.productId,
      productVersion:performance.snapshot.productVersion,
      sourceSnapshotId:performance.snapshot.sourceSnapshotId,
      ...(performance.snapshot.supplierProductKey
        ? {supplierProductKey:performance.snapshot.supplierProductKey}
        : {}),
      ...(performance.snapshot.commercialType
        ? {commercialType:performance.snapshot.commercialType}
        : {}),
      ...(performance.snapshot.vehiclePrice!==undefined
        ? {vehiclePrice:performance.snapshot.vehiclePrice}
        : {}),
      supplierId:performance.snapshot.supplierId,
      vehicleModel:{
        nodeId:performance.snapshot.vehicle.nodeId,
        originId:performance.snapshot.vehicle.originId,
        manufacturerId:performance.snapshot.vehicle.manufacturerId,
        modelId:performance.snapshot.vehicle.modelId,
        ...(performance.snapshot.vehicle.subModelId
          ? {subModelId:performance.snapshot.vehicle.subModelId}
          : {}),
        ...(performance.snapshot.vehicle.trimId
          ? {trimId:performance.snapshot.vehicle.trimId}
          : {}),
        ...(performance.snapshot.specs.fuel
          ? {fuel:performance.snapshot.specs.fuel}
          : {}),
      },
      offer:{
        runtimeOfferId:offer.id,
        ...(offer.sourceOfferId?{sourceOfferId:offer.sourceOfferId}:{}),
        ...(offer.sourceOfferRevision!==undefined?{sourceOfferRevision:offer.sourceOfferRevision}:{}),
        ...(offer.sourcePriceTermKey?{sourcePriceTermKey:offer.sourcePriceTermKey}:{}),
        termMonths:offer.termMonths,
        monthlyRent:offer.monthlyRent,
        ...(offer.deposit!==undefined?{deposit:offer.deposit}:{}),
        ...(offer.depositState?{depositState:offer.depositState}:{}),
        ...(offer.annualMileageKm!==undefined?{annualMileageKm:offer.annualMileageKm}:{}),
      },
      policies:performance.snapshot.policies.map((policy)=>
        policy.type==='MULTI_SELECT'?{...policy,value:[...policy.value]}:{...policy}
      ),
      deliveredAt:performance.snapshot.deliveredAt,
    },
    operational:{...operational},
  };
}

export async function suggestSettlementPricing(
  provider:SettlementPricingProvider,
  performance:Performance,
  operational:SettlementOperationalFacts={},
):Promise<SettlementPricingResult>{
  return provider.quote(settlementPricingInput(performance,operational));
}
