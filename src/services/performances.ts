import { datePrefix } from '../domain/application/application-number';
import { createNormalPerformance } from '../domain/performance/create-performance';
import { performanceNumber } from '../domain/performance/performance-number';
import type { ApplicationRepository, PerformanceRepository } from '../ports/repositories';

export interface PerformanceDeps {
  applications: ApplicationRepository;
  performances: PerformanceRepository;
  now: () => Date;
  newId: () => string;
  newSettlementCode: () => string;
}

export type EnsurePerformanceResult =
  | { ok: true; performance: Awaited<ReturnType<PerformanceRepository['get']>> extends infer T ? Exclude<T, null> : never; created: boolean }
  | { ok: false; reason: 'APPLICATION_NOT_FOUND' | 'NOT_DELIVERED' };

/**
 * 인도된 접수에 정상실적이 정확히 하나 있도록 보장한다.
 *
 * ★아직 이 함수 자체가 Application의 인도 체크와 같은 저장소 transaction은 아니다.
 * 운영 Firestore 전환 때는 «인도완료 + NORMAL 실적 생성»을 하나의 transaction/UoW로 묶어야 한다.
 * 이 함수는 이미 인도된 접수의 실적 생성/재시도 경계이며 applicationId로 멱등하다.
 */
export async function ensureNormalPerformance(
  deps: PerformanceDeps,
  applicationId: string,
): Promise<EnsurePerformanceResult> {
  const application = await deps.applications.get(applicationId);
  if (!application) return { ok: false, reason: 'APPLICATION_NOT_FOUND' };
  if (application.status !== 'DELIVERED' || !application.progress.deliveryCompleted) {
    return { ok: false, reason: 'NOT_DELIVERED' };
  }

  const existing = await deps.performances.findNormalByApplicationId(applicationId);
  if (existing) return { ok: true, performance: existing, created: false };

  const now = deps.now();
  const prefix = datePrefix(now);
  const stored = await deps.performances.createNormalSequenced(
    prefix,
    application.id,
    (sequence) =>
      createNormalPerformance({
        id: deps.newId(),
        performanceNumber: performanceNumber(prefix, sequence),
        settlementCode: deps.newSettlementCode(),
        application,
        now: now.toISOString(),
      }),
  );

  return { ok: true, ...stored };
}
