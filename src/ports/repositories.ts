import type { Application } from '../domain/application/types';
import type { Performance } from '../domain/performance/types';
import type { CanonicalProduct } from '../domain/product/types';
import type { Settlement } from '../domain/settlement/types';

/**
 * 저장소 «문»(port). 도메인은 이 문만 알고, 문 뒤가 파일인지 Firestore 인지 모른다.
 *
 * ★왜 문부터 긋나 — 독립 Firestore 자격증명이 아직 없다(WORK-INBOX §8 「독립 Firebase
 *   persistence 미검증」). 문 없이 바로 Firestore 를 부르면, 자격증명이 올 때까지
 *   아무것도 «실제로 저장되는지» 확인할 수 없고 화면은 계속 하드코딩으로 남는다.
 *   문을 그으면 오늘은 파일로 진짜 저장하고, 자격증명이 오면 «문 뒤만» 갈아 끼운다.
 *
 * ★RTDB 는 쓰지 않는다 (2026-09-14 폐기 확정). 문 뒤에 올 것은 Firestore 다.
 */

export interface ApplicationRepository {
  /**
   * 접수번호 발번 + submissionId 중복 확인 + 저장을 저장소의 한 원자 작업으로 묶는다.
   * build는 저장소가 확정한 그날 순번을 받아 Application을 만든다.
   *
   * 운영 Adapter(Firestore 등)는 이 전체를 하나의 transaction/atomic operation으로 구현해야 한다.
   */
  createSequenced(
    datePrefix: string,
    submissionId: string,
    build: (sequence: number) => Application,
  ): Promise<{ application: Application; created: boolean }>;

  get(id: string): Promise<Application | null>;
  findBySubmissionId(submissionId: string): Promise<Application | null>;

  /** 최신 접수가 앞. 접수목록 화면이 이걸 그대로 쓴다. */
  list(): Promise<Application[]>;

  /**
   * aggregate 한 건을 저장소의 원자 경계 안에서 읽고 변경한다.
   * 운영 Adapter는 transaction/compare-and-set 등 실제 원자성을 보장해야 한다.
   */
  mutate(id: string, change: (current: Application) => Application): Promise<Application>;
}

export interface PerformanceRepository {
  /**
   * 하나의 접수에는 NORMAL 실적을 정확히 하나만 만든다.
   * applicationId가 멱등키다. 운영 Firestore Adapter는 발번+중복확인+저장을 transaction으로 묶는다.
   */
  createNormalSequenced(
    datePrefix: string,
    applicationId: string,
    build: (sequence: number) => Performance,
  ): Promise<{ performance: Performance; created: boolean }>;

  get(id: string): Promise<Performance | null>;
  findNormalByApplicationId(applicationId: string): Promise<Performance | null>;
  list(): Promise<Performance[]>;
}

export interface SettlementRepository {
  /** Performance 하나당 정산 하나. performanceId가 멱등키다. */
  createForPerformance(
    performanceId: string,
    build: () => Settlement,
  ): Promise<{ settlement: Settlement; created: boolean }>;

  get(id: string): Promise<Settlement | null>;
  findByPerformanceId(performanceId: string): Promise<Settlement | null>;
  list(): Promise<Settlement[]>;
  mutate(id: string, change: (current: Settlement) => Settlement): Promise<Settlement>;
}

export interface ProductRepository {
  get(id: string): Promise<CanonicalProduct | null>;
  list(): Promise<CanonicalProduct[]>;
  save(product: CanonicalProduct): Promise<CanonicalProduct>;
}
