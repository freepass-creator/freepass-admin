import type { Offer, PolicyValue, VehicleMasterRef, VehicleSpecs } from '../product/types';
import type { ActorRef } from '../security/actor';

export type ApplicationStatus = 'RECEIVED' | 'CONTRACTED' | 'DELIVERED' | 'CANCELLED';

/**
 * 진행은 «상태» 가 아니라 «사실» 이다 — 계약서 · 필수서류 · 잔금 · 인도 완료 여부다.
 * 네 사실은 서로 독립적으로 기록한다. 파생 상태는 별도 함수가 계산한다.
 * `차량준비` 는 FreePass 업무가 아니므로 만들지 않는다 (AGENTS.md §9).
 */
export interface ApplicationProgress {
  contractCompleted: boolean;
  documentsCompleted: boolean;
  balanceCompleted: boolean;
  deliveryCompleted: boolean;
}

export type ApplicationHistoryEvent =
  | {
      type: 'APPLICATION_CREATED';
      occurredAt: string;
      actor: ActorRef;
      source: Application['source'];
    }
  | {
      type: 'APPLICATION_PROGRESS_CHANGED';
      occurredAt: string;
      actor: ActorRef;
      key: keyof ApplicationProgress;
      from: boolean;
      to: boolean;
    }
  | {
      type: 'APPLICATION_CANCELLED';
      occurredAt: string;
      actor: ActorRef;
      reason: string;
    };

/**
 * 접수 당시의 상품을 통째로 굳힌 것. 지금 상품이 바뀌어도 **이것은 안 바뀐다**.
 *
 * ★`productVersion` 이 핵심이다 — 이게 없으면 나중에 상품과 어긋났을 때
 *   「지금과 다르다」는 것만 알고 «어느 판을 보고 받았는지» 를 모른다.
 */
export interface ApplicationProductSnapshot {
  productId: string;
  productVersion: number;
  supplierId: string;
  vehicle: VehicleMasterRef;
  specs: VehicleSpecs;
  /** 검색에서 «고른 그 Offer» 하나. 다른 Offer 의 값을 섞지 않는다. */
  offer: Offer;
  productPolicies: PolicyValue[];
  capturedAt: string;
}

export interface Application {
  id: string;
  applicationNumber: string;

  /**
   * ★최초 접수 필수값은 정확히 넷이다 (WORK-INBOX §12) —
   *   차량/선택 Offer · 영업채널 · 담당자 · 고객명.
   *   차량/Offer 는 `snapshot` 이 들고 있고, 나머지 셋이 아래다.
   */
  applicantName: string;
  salesChannelId: string;
  assigneeId: string;

  /**
   * ★전화번호는 «최초 접수에 강제하지 않는다». 상담만 하고 번호를 아직 안 받은 건도
   *   접수로 남아야 한다. 필수로 박으면 직원이 `010-0000-0000` 을 넣는다 —
   *   그 순간 원장에 «가짜 번호» 가 쌓이고, 그게 진짜보다 위험하다.
   */
  applicantPhone?: string;

  source: 'ADMIN' | 'SALES' | 'WHITE_LABEL';
  status: ApplicationStatus;
  progress: ApplicationProgress;
  snapshot: ApplicationProductSnapshot;

  /**
   * ★중복 저장을 «서버가» 막는 열쇠. 버튼 disabled 로는 못 막는다 —
   *   느린 회선에서 두 번 누르거나, 새로고침하거나, 창을 둘 띄우면 두 건이 들어온다.
   *   같은 `submissionId` 로 다시 들어오면 새로 만들지 않고 «이미 만든 것» 을 돌려준다.
   */
  submissionId: string;

  /** 같은 aggregate 저장 안에서 상태 변경과 함께 보존하는 최소 감사 이력. */
  history: ApplicationHistoryEvent[];

  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
}
