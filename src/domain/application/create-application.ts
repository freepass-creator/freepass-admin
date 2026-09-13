import type { CanonicalProduct, Offer } from '../product/types';
import type { Application } from './types';

export interface CreateApplicationInput {
  id: string;
  applicationNumber: string;
  applicantName: string;
  applicantPhone: string;
  source: Application['source'];
  channelId?: string;
  product: CanonicalProduct;
  offerId: string;
  now: string;
}

export function createApplication(input: CreateApplicationInput): Application {
  const offer = input.product.offers.find((candidate) => candidate.id === input.offerId);
  if (!offer) throw new Error('Selected offer does not belong to the product.');

  const snapshotOffer: Offer = {
    ...offer,
    policyValues: offer.policyValues.map((policy) => ({ ...policy })),
  };

  return {
    id: input.id,
    applicationNumber: input.applicationNumber,
    applicantName: input.applicantName,
    applicantPhone: input.applicantPhone,
    source: input.source,
    channelId: input.channelId,
    status: 'RECEIVED',
    progress: {
      contractCompleted: false,
      documentsCompleted: false,
      deliveryCompleted: false,
    },
    snapshot: {
      productId: input.product.id,
      supplierId: input.product.supplierId,
      vehicle: { ...input.product.vehicle },
      specs: { ...input.product.specs },
      offer: snapshotOffer,
      productPolicies: input.product.productPolicies.map((policy) => ({ ...policy })),
      capturedAt: input.now,
    },
    createdAt: input.now,
    updatedAt: input.now,
  };
}
