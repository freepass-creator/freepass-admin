import type { Offer, PolicyValue, VehicleMasterRef, VehicleSpecs } from '../product/types';

export type ApplicationStatus = 'RECEIVED' | 'CONTRACTED' | 'DELIVERED' | 'CANCELLED';

export interface ApplicationProgress {
  contractCompleted: boolean;
  documentsCompleted: boolean;
  deliveryCompleted: boolean;
}

export interface ApplicationProductSnapshot {
  productId: string;
  supplierId: string;
  vehicle: VehicleMasterRef;
  specs: VehicleSpecs;
  offer: Offer;
  productPolicies: PolicyValue[];
  capturedAt: string;
}

export interface Application {
  id: string;
  applicationNumber: string;
  applicantName: string;
  applicantPhone: string;
  channelId?: string;
  source: 'ADMIN' | 'SALES' | 'WHITE_LABEL';
  status: ApplicationStatus;
  progress: ApplicationProgress;
  snapshot: ApplicationProductSnapshot;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
}
