import type { Offer, PolicyValue, RegistrationInfo, VehicleMasterRef } from '../product/types';

export type VatMode = 'INCLUDED' | 'EXCLUDED' | 'UNDECIDED';

export type PerformanceStatus =
  | 'AWAITING_AMOUNTS'
  | 'AWAITING_SALESPERSON_CONFIRMATION'
  | 'AWAITING_SUPPLIER_REVIEW'
  | 'SUPPLIER_ISSUE'
  | 'AWAITING_SALESPERSON_RECONFIRMATION'
  | 'READY_TO_FINALIZE'
  | 'FINALIZED';

export interface SettlementAmounts {
  supplierReceivable: number | null;
  channelPayable: number | null;
  vatMode: VatMode;
}

export interface PerformanceSnapshot {
  applicationNumber: string;
  customerName: string;
  supplierId: string;
  salesChannelId: string;
  assigneeId: string;
  productId: string;
  productVersion: string;
  vehicleLabel: string;
  vehicle: VehicleMasterRef;
  registration?: RegistrationInfo;
  offer: Offer;
  policies: PolicyValue[];
  deliveredAt: string;
}

export interface ReviewDecision {
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED';
  actorId?: string;
  decidedAt?: string;
  reason?: string;
}

export interface SupplierReview extends ReviewDecision {
  affectsChannelPayable?: boolean;
}

export interface Reconfirmation {
  status: 'NOT_REQUIRED' | 'PENDING' | 'ACCEPTED' | 'DISPUTED';
  actorId?: string;
  decidedAt?: string;
  reason?: string;
}

export interface Performance {
  id: string;
  applicationId: string;
  deliveryEventId: string;
  status: PerformanceStatus;
  snapshot: PerformanceSnapshot;
  amounts: SettlementAmounts;
  salespersonReview: ReviewDecision;
  supplierReview: SupplierReview;
  reconfirmation: Reconfirmation;
  resolution?: { actorId: string; reason: string; resolvedAt: string };
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
}
