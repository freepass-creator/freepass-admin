import { applicationNumber, datePrefix } from '../domain/application/application-number';
import { isAppError } from '../domain/errors';
import { createApplication } from '../domain/application/create-application';
import type { Application } from '../domain/application/types';
import { cancelApplication, updateApplicationProgress, type ProgressKey } from '../domain/application/update-progress';
import type { ActorProvider } from '../ports/auth';
import { requireActiveAssignee, requireActiveSalesChannel, type ReferenceMaster } from '../domain/reference-master/types';
import type { ApplicationRepository, ProductRepository } from '../ports/repositories';

export interface SubmitApplicationInput {
  /** 최초 접수 필수 넷 (차량/Offer 는 아래 둘이 가리킨다). */
  productId: string;
  offerId: string;
  salesChannelId: string;
  assigneeId: string;
  applicantName: string;

  applicantPhone?: string;

  /**
   * ★화면이 «보고 있던» 상품의 판. 지금 판과 다르면 저장하지 않고 되돌린다 —
   *   접수 화면을 열어 둔 사이에 상품이 바뀌었는데 조용히 새 값으로 받으면,
   *   직원은 «자기가 본 조건»으로 받은 줄 알고 고객에게는 다른 값을 말하게 된다.
   */
  expectedProductVersion: number;

  /** ★같은 값으로 두 번 오면 한 건만 만든다. 버튼 disabled 로는 못 막는다. */
  submissionId: string;

  source?: Application['source'];
}

export type SubmitResult =
  | { ok: true; application: Application; created: boolean }
  | { ok: false; reason: 'PRODUCT_NOT_FOUND' }
  | { ok: false; reason: 'OFFER_NOT_FOUND' }
  | { ok: false; reason: 'SALES_CHANNEL_NOT_ACTIVE' }
  | { ok: false; reason: 'ASSIGNEE_NOT_ACTIVE' }
  | { ok: false; reason: 'PRODUCT_CHANGED'; currentVersion: number; seenVersion: number };

export interface Deps {
  products: ProductRepository;
  applications: ApplicationRepository;
  now: () => Date;
  newId: () => string;
  actors: ActorProvider;
  masters: ReferenceMaster;
}

/**
 * 접수 한 건을 받는다.
 *
 * 순서가 중요하다 — **중복 확인이 먼저**다. 같은 submissionId 로 다시 온 요청은
 * 상품이 그 사이에 바뀌었더라도 `PRODUCT_CHANGED` 가 아니라 «이미 만든 건»을 돌려줘야 한다.
 * 안 그러면 응답만 못 받고 실제로는 저장된 요청을 재시도했을 때, 사용자에게
 * 「상품이 바뀌었다」는 엉뚱한 말을 하면서 정작 접수는 이미 들어가 있는 꼴이 된다.
 */
export async function submitApplication(deps: Deps, input: SubmitApplicationInput): Promise<SubmitResult> {
  const actor = await deps.actors.requireActor();
  const already = await deps.applications.findBySubmissionId(input.submissionId);
  if (already) return { ok: true, application: already, created: false };

  const product = await deps.products.get(input.productId);
  if (!product) return { ok: false, reason: 'PRODUCT_NOT_FOUND' };

  if (product.version !== input.expectedProductVersion) {
    return {
      ok: false,
      reason: 'PRODUCT_CHANGED',
      currentVersion: product.version,
      seenVersion: input.expectedProductVersion,
    };
  }

  if (!product.offers.some((offer) => offer.id === input.offerId)) {
    return { ok: false, reason: 'OFFER_NOT_FOUND' };
  }

  try {
    await requireActiveSalesChannel(deps.masters, input.salesChannelId);
  } catch {
    return { ok: false, reason: 'SALES_CHANNEL_NOT_ACTIVE' };
  }
  try {
    await requireActiveAssignee(deps.masters, input.assigneeId);
  } catch {
    return { ok: false, reason: 'ASSIGNEE_NOT_ACTIVE' };
  }

  const now = deps.now();
  const prefix = datePrefix(now);

  const stored = await deps.applications.createSequenced(
    prefix,
    input.submissionId,
    (sequence) =>
      createApplication({
        id: deps.newId(),
        applicationNumber: applicationNumber(prefix, sequence),
        applicantName: input.applicantName,
        salesChannelId: input.salesChannelId,
        assigneeId: input.assigneeId,
        applicantPhone: input.applicantPhone,
        source: input.source ?? 'ADMIN',
        product,
        offerId: input.offerId,
        submissionId: input.submissionId,
        actor,
        now: now.toISOString(),
      }),
  );

  return { ok: true, ...stored };
}

export type ProgressResult =
  | { ok: true; application: Application }
  | { ok: false; reason: 'NOT_FOUND' }
  | { ok: false; reason: 'CANCELLED' };

export async function markProgress(
  deps: Pick<Deps, 'applications' | 'now' | 'actors'>,
  id: string,
  key: ProgressKey,
  completed: boolean,
): Promise<ProgressResult> {
  const actor = await deps.actors.requireActor();
  const existing = await deps.applications.get(id);
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };
  if (existing.status === 'CANCELLED') return { ok: false, reason: 'CANCELLED' };

  try {
    const application = await deps.applications.mutate(id, (current) => {
      if (current.status === 'CANCELLED') throw new Error('CANCELLED');
      return updateApplicationProgress(current, key, completed, deps.now().toISOString(), actor);
    });
    return { ok: true, application };
  } catch (error) {
    if (isAppError(error, 'CANCELLED')) return { ok: false, reason: 'CANCELLED' };
    throw error;
  }
}

export type CancelResult =
  | { ok: true; application: Application }
  | { ok: false; reason: 'NOT_FOUND' }
  | { ok: false; reason: 'REASON_REQUIRED' };

/** ★취소는 지우는 것이 아니다. 이유를 받아 남긴다 — 목록에서 사라지지 않는다. */
export async function cancel(
  deps: Pick<Deps, 'applications' | 'now' | 'actors'>,
  id: string,
  reason: string,
): Promise<CancelResult> {
  const actor = await deps.actors.requireActor();
  const existing = await deps.applications.get(id);
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };
  if (!reason.trim()) return { ok: false, reason: 'REASON_REQUIRED' };

  // 이미 취소된 건을 다시 취소해도 «첫 이유»를 덮지 않는다.
  if (existing.status === 'CANCELLED') return { ok: true, application: existing };

  const application = await deps.applications.mutate(id, (current) =>
    cancelApplication(current, reason, deps.now().toISOString(), actor),
  );
  return { ok: true, application };
}
