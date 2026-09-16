import type { Application } from '../domain/application/types';
import type { CanonicalProduct } from '../domain/product/types';

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
   * ★중복 저장을 막는 자리. 같은 `submissionId` 가 이미 있으면 **새로 만들지 않고
   *   있던 것을 돌려준다.** 저장소가 막아야 한다 — 화면의 disabled 는 창을 둘 띄우면 뚫린다.
   *
   * @returns `created` — 이번에 진짜 만들어졌나. `false` 면 중복 요청이 걸러진 것이다.
   */
  create(application: Application): Promise<{ application: Application; created: boolean }>;

  get(id: string): Promise<Application | null>;

  findBySubmissionId(submissionId: string): Promise<Application | null>;

  /** 최신 접수가 앞. 접수목록 화면이 이걸 그대로 쓴다. */
  list(): Promise<Application[]>;

  /** 이미 있는 건만 갈아 끼운다. 없으면 던진다 — 조용히 만들어 내지 않는다. */
  update(application: Application): Promise<Application>;

  /** 접수번호를 발번하기 위한 그날치 개수. */
  countByDatePrefix(prefix: string): Promise<number>;
}

export interface ProductRepository {
  get(id: string): Promise<CanonicalProduct | null>;
  list(): Promise<CanonicalProduct[]>;
  save(product: CanonicalProduct): Promise<CanonicalProduct>;
}
