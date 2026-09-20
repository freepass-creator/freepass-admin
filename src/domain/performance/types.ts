import type { ApplicationProductSnapshot } from '../application/types';

export type PerformanceKind = 'NORMAL' | 'CLAWBACK';

/**
 * 인도 뒤에 생기는 «실적» 정본.
 *
 * F04의 분납실적/완납실적 탭을 데이터모델로 복제하지 않는다.
 * 분납/완납은 정산 상태이며 Performance는 «실적이 발생했다»는 불변 사실이다.
 */
export interface Performance {
  id: string;
  performanceNumber: string;
  kind: PerformanceKind;

  /** NORMAL 실적의 출처. 하나의 접수에는 NORMAL 실적 하나만 존재한다. */
  applicationId: string;
  applicationNumber: string;

  /** CLAWBACK일 때 원 실적. NORMAL이면 없음. */
  originPerformanceId?: string;
  reason?: string;

  /** F04 병행/향후 ERP 정산 연결에 쓰는 안정 키. 차량번호가 시스템 키가 되면 안 된다. */
  settlementCode: string;

  applicantName: string;
  salesChannelId: string;
  assigneeId: string;

  /** 접수 당시 계약조건을 다시 굳힌다. 현재 상품을 재조회하지 않는다. */
  snapshot: ApplicationProductSnapshot;

  /** 정상실적은 인도 시각, 환수실적은 환수 확정 시각. */
  occurredAt: string;
  createdAt: string;
}
