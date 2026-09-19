import { AppError } from '../errors';
import type { Application, ApplicationHistoryEvent } from './types';

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function historyPrefixIsPreserved(
  before: ApplicationHistoryEvent[],
  after: ApplicationHistoryEvent[],
): boolean {
  if (after.length < before.length) return false;
  return before.every((event, index) => sameJson(event, after[index]));
}

/**
 * Application aggregate에서 바뀌면 안 되는 값을 저장소 쓰기 직전에 검증한다.
 *
 * 진행/취소는 바뀔 수 있지만 접수 당시의 식별/조건/과거 감사이력은 조용히 덮지 않는다.
 */
export function assertApplicationMutation(before: Application, after: Application): void {
  if (after.id !== before.id) {
    throw new AppError('CONFLICT', 'Application id is immutable.');
  }
  if (after.applicationNumber !== before.applicationNumber) {
    throw new AppError('CONFLICT', 'Application number is immutable.');
  }
  if (after.submissionId !== before.submissionId) {
    throw new AppError('CONFLICT', 'Application submissionId is immutable.');
  }
  if (after.createdAt !== before.createdAt) {
    throw new AppError('CONFLICT', 'Application createdAt is immutable.');
  }
  if (!sameJson(after.snapshot, before.snapshot)) {
    throw new AppError('CONFLICT', 'Application snapshot is immutable.');
  }
  if (!historyPrefixIsPreserved(before.history, after.history)) {
    throw new AppError('CONFLICT', 'Application history is append-only.');
  }
}
