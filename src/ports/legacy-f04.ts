import type { Application } from '../domain/application/types';
import type { Performance } from '../domain/performance/types';
import type { Settlement } from '../domain/settlement/types';

export interface LegacyMirrorReceipt {
  target: 'F04';
  entityType: 'APPLICATION' | 'PERFORMANCE' | 'SETTLEMENT';
  entityId: string;
  idempotencyKey: string;
  mirroredAt: string;
  legacyRowKey?: string;
  warnings: string[];
}

/**
 * F04는 과도기 미러 대상이다.
 *
 * Admin 서비스가 Google Sheets 열/탭을 직접 알지 않도록 이 포트 뒤에 가둔다.
 * 최종 단독 운영 시 이 Adapter만 제거하면 Domain/Service는 그대로 남아야 한다.
 */
export interface LegacyF04Mirror {
  mirrorApplication(application: Application): Promise<LegacyMirrorReceipt>;
  mirrorPerformance(performance: Performance): Promise<LegacyMirrorReceipt>;
  mirrorSettlement(settlement: Settlement): Promise<LegacyMirrorReceipt>;
}
