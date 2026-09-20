import type { Offer, PolicyValue, RegistrationInfo, VehicleMasterRef, VehicleSpecs } from '../product/types';

export type VatMode = 'INCLUDED' | 'EXCLUDED' | 'UNDECIDED';

export type PerformanceStatus =
  | 'AWAITING_AMOUNTS'
  | 'AWAITING_SALESPERSON_CONFIRMATION'
  | 'AWAITING_SUPPLIER_REVIEW'
  | 'AWAITING_SALESPERSON_RECONFIRMATION'
  | 'SUPPLIER_ISSUE'
  | 'READY_TO_FINALIZE'
  | 'FINALIZED';

export interface SettlementAmounts {
  supplierReceivable: number | null;
  channelPayable: number | null;
  vatMode: VatMode;
}

export type ReviewDecision =
  | { status: 'PENDING' }
  | { status: 'CONFIRMED'; partyId: string; recordedByAdminId: string; decidedAt: string }
  | { status: 'DISPUTED'; partyId: string; recordedByAdminId: string; decidedAt: string; reason: string };

export type Reconfirmation =
  | { status: 'NOT_REQUIRED' }
  | { status: 'REQUIRED'; reason: string }
  | { status: 'CONFIRMED'; partyId: string; recordedByAdminId: string; decidedAt: string };

export interface Performance {
  id: string;
  applicationId: string;
  deliveryEvidenceAt: string;
  status: PerformanceStatus;
  snapshot: {
    applicationNumber: string;
    applicantName: string;
    supplierId: string;
    salesChannelId: string;
    assigneeId: string;
    productId: string;
    productVersion: number;
    sourceSnapshotId?: string;
    supplierProductKey?: string;
    commercialType?: string;
    vehiclePrice?: number;
    vehicle: VehicleMasterRef;
    specs: VehicleSpecs;
    registration?: RegistrationInfo;
    offer: Offer;
    policies: PolicyValue[];
    deliveredAt: string;
  };
  amounts: SettlementAmounts;
  salespersonReview: ReviewDecision;
  supplierReview: ReviewDecision;
  reconfirmation: Reconfirmation;
  resolution?: { recordedByAdminId: string; reason: string; resolvedAt: string };
  createdAt: string;
  updatedAt: string;
}
