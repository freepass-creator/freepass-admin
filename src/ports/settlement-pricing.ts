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
