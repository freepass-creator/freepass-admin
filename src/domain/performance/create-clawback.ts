import { AppError } from '../errors';
import { cloneApplicationProductSnapshot } from './create-performance';
import type { Performance } from './types';

export interface CreateClawbackPerformanceInput {
  id: string;
  performanceNumber: string;
  settlementCode: string;
  origin: Performance;
  reason: string;
  now: string;
}

/**
 * 환수는 원 실적을 수정하지 않는다.
 * NORMAL 실적을 origin으로 가리키는 별도 CLAWBACK 실적 한 줄을 만든다.
 */
export function createClawbackPerformance(input: CreateClawbackPerformanceInput): Performance {
  if (input.origin.kind !== 'NORMAL') {
    throw new AppError('CONFLICT', 'Clawback origin must be a NORMAL performance.');
  }
  if (!input.reason.trim()) throw new AppError('VALIDATION', 'Clawback reason is required.');
  if (!input.settlementCode.trim()) throw new AppError('VALIDATION', 'settlementCode is required.');

  return {
    id: input.id,
    performanceNumber: input.performanceNumber,
    kind: 'CLAWBACK',
    applicationId: input.origin.applicationId,
    applicationNumber: input.origin.applicationNumber,
    originPerformanceId: input.origin.id,
    reason: input.reason.trim(),
    settlementCode: input.settlementCode.trim(),
    applicantName: input.origin.applicantName,
    salesChannelId: input.origin.salesChannelId,
    assigneeId: input.origin.assigneeId,
    snapshot: cloneApplicationProductSnapshot(input.origin.snapshot),
    occurredAt: input.now,
    createdAt: input.now,
  };
}
