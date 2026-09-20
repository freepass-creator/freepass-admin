import { AppError } from '../errors';
import type { Application, ApplicationProductSnapshot } from '../application/types';
import type { PolicyValue } from '../product/types';
import type { Performance } from './types';

export interface CreateNormalPerformanceInput {
  id: string;
  performanceNumber: string;
  settlementCode: string;
  application: Application;
  now: string;
}

function clonePolicyValue(policy: PolicyValue): PolicyValue {
  return policy.type === 'MULTI_SELECT'
    ? { ...policy, value: [...policy.value] }
    : { ...policy };
}

function cloneSnapshot(snapshot: ApplicationProductSnapshot): ApplicationProductSnapshot {
  return {
    ...snapshot,
    vehicle: { ...snapshot.vehicle },
    specs: { ...snapshot.specs },
    ...(snapshot.registration ? { registration: { ...snapshot.registration } } : {}),
    offer: {
      ...snapshot.offer,
      policyValues: snapshot.offer.policyValues.map(clonePolicyValue),
    },
    productPolicies: snapshot.productPolicies.map(clonePolicyValue),
  };
}

/**
 * 인도 완료된 접수에서 정상 실적을 만든다.
 * 현재 상품은 절대 다시 읽지 않는다 — 접수 Snapshot만 사용한다.
 */
export function createNormalPerformance(input: CreateNormalPerformanceInput): Performance {
  if (input.application.status !== 'DELIVERED' || !input.application.progress.deliveryCompleted) {
    throw new AppError('CONFLICT', 'Performance can only be created from a delivered application.');
  }

  if (!input.settlementCode.trim()) {
    throw new AppError('VALIDATION', 'settlementCode is required.');
  }

  return {
    id: input.id,
    performanceNumber: input.performanceNumber,
    kind: 'NORMAL',
    applicationId: input.application.id,
    applicationNumber: input.application.applicationNumber,
    settlementCode: input.settlementCode.trim(),
    applicantName: input.application.applicantName,
    salesChannelId: input.application.salesChannelId,
    assigneeId: input.application.assigneeId,
    snapshot: cloneSnapshot(input.application.snapshot),
    occurredAt: input.application.updatedAt,
    createdAt: input.now,
  };
}
