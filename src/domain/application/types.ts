import type { Offer, PolicyValue, RegistrationInfo, VehicleMasterRef, VehicleSpecs } from '../product/types';

export type ApplicationStatus = 'RECEIVED' | 'CONTRACTED' | 'DELIVERED' | 'CANCELLED';

export interface ApplicationProgress {
  contractCompleted: boolean;
  documentsCompleted: boolean;
  deliveryCompleted: boolean;
}

export interface ApplicationProductSnapshot {
  productId: string;
  productVersion: string;
  supplierId: string;
  vehicleLabel: string;
  vehicle: VehicleMasterRef;
  specs: VehicleSpecs;
  registration?: RegistrationInfo;
  offer: Offer;
  productPolicies: PolicyValue[];
  capturedAt: string;
}

export interface Application {
  id: string;
  applicationNumber: string;
  submissionId: string;
  customerName: string;
  customerPhone?: string;
  salesChannelId: string;
  assigneeId: string;
  source: 'ADMIN' | 'SALES' | 'WHITE_LABEL';
  status: ApplicationStatus;
  progress: ApplicationProgress;
  snapshot: ApplicationProductSnapshot;
  createdAt: string;
  updatedAt: string;
  deliveryEventId?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export type ApplicationEventType =
  | 'APPLICATION_CREATED'
  | 'CONTRACT_UPDATED'
  | 'DOCUMENTS_UPDATED'
  | 'DELIVERY_UPDATED'
  | 'APPLICATION_CANCELLED';

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  type: ApplicationEventType;
  actorId: string;
  occurredAt: string;
  reason?: string;
  changes: Record<string, unknown>;
}
