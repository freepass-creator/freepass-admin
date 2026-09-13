import type { CanonicalProduct, Offer } from '../product/types';
import type { Application } from './types';

export interface CreateApplicationInput {
  id: string;
  applicationNumber: string;
  submissionId: string;
  customerName: string;
  customerPhone?: string;
  salesChannelId: string;
  assigneeId: string;
  source: Application['source'];
  product: CanonicalProduct;
  productVersion: string;
  offerId: string;
  now: string;
}

function clonePolicyValue<T extends Offer['policyValues'][number]>(policy: T): T {
  return {
    ...policy,
    value: Array.isArray(policy.value) ? [...policy.value] : policy.value,
  } as T;
}

export function createApplication(input: CreateApplicationInput): Application {
  if (!input.submissionId.trim()) throw new Error('Submission id is required.');
  if (!input.customerName.trim()) throw new Error('Customer name is required.');
  if (!input.salesChannelId.trim()) throw new Error('Sales channel is required.');
  if (!input.assigneeId.trim()) throw new Error('Assignee is required.');
  if (!input.productVersion.trim()) throw new Error('Product version is required.');
  if (input.product.version !== input.productVersion) throw new Error('PRODUCT_VERSION_CONFLICT');

  const offer = input.product.offers.find((candidate) => candidate.id === input.offerId);
  if (!offer) throw new Error('Selected offer does not belong to the product.');

  const snapshotOffer: Offer = {
    ...offer,
    policyValues: offer.policyValues.map(clonePolicyValue),
  };

  return {
    id: input.id,
    applicationNumber: input.applicationNumber,
    submissionId: input.submissionId.trim(),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() || undefined,
    salesChannelId: input.salesChannelId.trim(),
    assigneeId: input.assigneeId.trim(),
    source: input.source,
    status: 'RECEIVED',
    progress: {
      contractCompleted: false,
      documentsCompleted: false,
      deliveryCompleted: false,
    },
    snapshot: {
      productId: input.product.id,
      productVersion: input.product.version,
      supplierId: input.product.supplierId,
      vehicleLabel: input.product.displayName,
      vehicle: { ...input.product.vehicle },
      specs: { ...input.product.specs },
      registration: input.product.registration ? { ...input.product.registration } : undefined,
      offer: snapshotOffer,
      productPolicies: input.product.productPolicies.map(clonePolicyValue),
      capturedAt: input.now,
    },
    createdAt: input.now,
    updatedAt: input.now,
  };
}
