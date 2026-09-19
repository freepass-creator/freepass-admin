import { AppError } from '../errors';
import type { CanonicalProduct, Offer, PolicyValue } from '../product/types';
import { assertActor, type ActorRef } from '../security/actor';
import type { Application } from './types';

export interface CreateApplicationInput {
  id: string;
  applicationNumber: string;

  /** 최초 접수 필수 넷 중 셋 (나머지 하나는 product+offerId). */
  applicantName: string;
  salesChannelId: string;
  assigneeId: string;

  /** 선택 — 아직 안 받았을 수 있다. */
  applicantPhone?: string;

  source: Application['source'];
  product: CanonicalProduct;
  offerId: string;
  submissionId: string;
  actor: ActorRef;
  now: string;
}

function clonePolicyValue(policy: PolicyValue): PolicyValue {
  return policy.type === 'MULTI_SELECT'
    ? { ...policy, value: [...policy.value] }
    : { ...policy };
}

function required(value: string | undefined, field: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) throw new AppError('VALIDATION', `${field} is required.`, { field });
  return trimmed;
}

/**
 * 접수 한 건을 «만든다». 저장은 안 한다 — 저장은 repository 가 한다.
 *
 * ★여기서 Snapshot 을 깊게 베낀다. 얕게 두면 나중에 상품 객체를 손대는 순간
 *   «이미 받은 접수의 계약조건» 이 조용히 따라 바뀐다. 그건 사고지 갱신이 아니다.
 */
export function createApplication(input: CreateApplicationInput): Application {
  const offer = input.product.offers.find((candidate) => candidate.id === input.offerId);
  if (!offer) throw new AppError('CONFLICT', 'Selected offer does not belong to the product.');

  const applicantName = required(input.applicantName, 'applicantName');
  const salesChannelId = required(input.salesChannelId, 'salesChannelId');
  const assigneeId = required(input.assigneeId, 'assigneeId');
  const submissionId = required(input.submissionId, 'submissionId');
  const actor = assertActor(input.actor);

  const snapshotOffer: Offer = {
    ...offer,
    policyValues: offer.policyValues.map(clonePolicyValue),
  };

  const applicantPhone = input.applicantPhone?.trim();

  return {
    id: input.id,
    applicationNumber: input.applicationNumber,
    applicantName,
    salesChannelId,
    assigneeId,
    ...(applicantPhone ? { applicantPhone } : {}),
    source: input.source,
    status: 'RECEIVED',
    progress: {
      contractCompleted: false,
      documentsCompleted: false,
      balanceCompleted: false,
      deliveryCompleted: false,
    },
    snapshot: {
      productId: input.product.id,
      productVersion: input.product.version,
      supplierId: input.product.supplierId,
      vehicle: { ...input.product.vehicle },
      specs: { ...input.product.specs },
      offer: snapshotOffer,
      productPolicies: input.product.productPolicies.map(clonePolicyValue),
      capturedAt: input.now,
    },
    submissionId,
    history: [
      {
        type: 'APPLICATION_CREATED',
        occurredAt: input.now,
        actor,
        source: input.source,
      },
    ],
    createdAt: input.now,
    updatedAt: input.now,
  };
}
