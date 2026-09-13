import type { CanonicalProduct, Offer, PolicyValue } from '../product/types';
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

/** 정책 객체뿐 아니라 복수선택 값도 복사하여 원본과 스냅샷을 분리한다. */
function clonePolicyValue(policy: PolicyValue): PolicyValue {
  if (policy.type === 'MULTI_SELECT') {
    return { ...policy, value: [...policy.value] };
  }
  return { ...policy };
}

export function createApplication(input: CreateApplicationInput): Application {
  const offer = input.product.offers.find((candidate) => candidate.id === input.offerId);
  if (!offer) throw new Error('Selected offer does not belong to the product.');

  const snapshotOffer: Offer = {
    ...offer,
    policyValues: offer.policyValues.map(clonePolicyValue),
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
      productPolicies: input.product.productPolicies.map(clonePolicyValue),
      capturedAt: input.now,
    },
    createdAt: input.now,
    updatedAt: input.now,
  };
}
