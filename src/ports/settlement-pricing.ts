import type { Performance } from '../domain/performance/types';
import type { PolicyValue } from '../domain/product/types';

export type SettlementOperationalFacts = {
  /** Written billing month wins over calculated month when already fixed. */
  billingMonth?: string;
  /** 일시납 / 2회분납 / 3회분납 등 운영 사실. */
  paymentPlan?: string;
  paidRounds?: number;

  settleTarget?: 'ALL' | 'SUPPLIER' | 'CHANNEL';
  settleRatio?: number;
  settleExclude?: boolean;
  billHold?: boolean;

  claimIncentive?: number;
  payIncentive?: number;

  /** true when the written amount already includes VAT. */
  vatIncluded?: boolean;
};

export type SettlementCatalogFacts = {
  productId: string;
  productVersion: number;
  sourceSnapshotId: string;
  supplierProductKey?: string;
  commercialType?: string;
  vehiclePrice?: number;

  supplierId: string;
  vehicleModel: {
    nodeId: string;
    originId: string;
    manufacturerId: string;
    modelId: string;
    subModelId?: string;
    trimId?: string;
    fuel?: string;
  };

  offer: {
    runtimeOfferId: string;
    sourceOfferId?: string;
    sourceOfferRevision?: number;
    sourcePriceTermKey?: string;
    termMonths: number;
    monthlyRent: number;
    deposit?: number;
    depositState?: 'KNOWN' | 'ZERO' | 'UNKNOWN' | 'NOT_APPLICABLE';
    annualMileageKm?: number;
  };

  policies: PolicyValue[];
  deliveredAt: string;
};

export type SettlementPricingInput = {
  performanceId: string;
  applicationId: string;
  catalog: SettlementCatalogFacts;
  operational: SettlementOperationalFacts;
};

export type SettlementPricingEvidence = {
  engineId: string;
  engineRevision: string;
  ruleId?: string;
  sourceRevision?: string;
  explanation: string;
};

export type SettlementPricingResult =
  | {
      status: 'READY';
      supplierReceivable: number;
      channelPayable: number;
      vatMode: 'INCLUDED' | 'EXCLUDED';
      billingMonth?: string;
      evidence: SettlementPricingEvidence;
    }
  | {
      status: 'REVIEW_REQUIRED';
      reason: string;
      missingFacts: string[];
      evidence: SettlementPricingEvidence;
    };

/**
 * Pricing logic stays outside Admin workflow state transitions.
 *
 * A future implementation may reverse-import the proven fp-settlement pure engine.
 * FreePass Data may provide versioned input facts, but it does not own the Admin
 * Performance review / Billing / Collection / Payout workflow.
 */
export interface SettlementPricingProvider {
  quote(input: SettlementPricingInput): Promise<SettlementPricingResult>;
}

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
