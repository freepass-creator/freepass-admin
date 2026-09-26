/**
 * **환수 — 열어 둔다.**  대표 2026-09-18 「접수해서 완료실적되서 청구해서 지급하면 끝. 환수가 생기는경우가 있을수도 있으니까 그건 열어두고」
 *
 * ★환수는 접수 줄의 체크가 아니라 «반대 부호의 한 줄» 이다 — ERP5 `settlement_clawbacks` 에 따로 선다
 *   (erp4 settlement-atom 「두 곳에 두면 갈린다」 · 사장님 2026-09-01 「환수는 따로」).
 *   청구목록·지급목록은 «환수일이 든 달» 에 그 상대에서 뺀다(ledgers.ts · lifecycle planInvoice).
 *
 * ★금액은 «사람이 넣는다» — 환수 조건이 공급사·정책마다 다르다(오토플러스 「3개월 유지」 · 무보증 심사 「6개월」 …).
 *   기계가 짐작해 넣으면 그 값이 그대로 청구서에서 빠진다. 사유가 없으면 안 받는다.
 * ★꼴은 기존 23건과 같다 — 문서 id `{차번}_{환수월}` (erp4 atomize 와 같은 열쇠), 칸 plate·model·at·supplierAmt·agentAmt·reason·supplier·channel·month·by.
 *   ⚠ 한 차가 «같은 달» 에 두 번 환수되면 id 가 겹친다 — 그때는 새로 세우지 않고 «이미 있다» 고 말한다(고치기로).
 */
import type { SettlementRow } from './types';

export type TerminationClawbackDecision = 'REQUIRED' | 'NOT_REQUIRED';
export type TerminationClawbackReview =
  | 'NONE'
  | 'PENDING'
  | 'REQUIRED'
  | 'NOT_REQUIRED'
  | 'RECORDED'
  | 'INCONSISTENT';

type TerminationClawbackRow = Pick<SettlementRow, 'id' | 'contractTerminatedAt' | 'contractTerminationDate'> & {
  contractClawbackReviewDecision?: string | null;
  contractClawbackReviewedAt?: number | null;
  contractClawbackReviewReason?: string | null;
  contractClawbackReviewOperationId?: string | null;
};

export interface TerminationClawbackReviewInput {
  decision: TerminationClawbackDecision;
  reason: string;
  operationId: string;
}

export type TerminationClawbackReviewPlan =
  | { ok: true; idempotent: boolean; patch: Record<string, unknown> }
  | { ok: false; error: string };

const OP = /^[A-Za-z0-9_-]{16,128}$/;
const reviewText = (v: unknown) => String(v ?? '').trim();

/**
 * 계약해지는 «환수 확정»이 아니라 별도의 환수 검토를 시작시키는 사실이다.
 *
 * NONE         해지 아님
 * PENDING      해지됐지만 아직 사람이 검토하지 않음
 * REQUIRED     사람이 환수 필요로 확정했지만 아직 환수 원장이 없음
 * NOT_REQUIRED 사람이 환수 없음으로 확정함
 * RECORDED     이 접수(code)에 연결된 실제 환수 원장이 있음
 * INCONSISTENT 검토 사실이 부분 기록됐거나 «환수 없음»과 실제 환수가 충돌함
 *
 * 정산 자체는 이 상태 때문에 되돌리거나 막지 않는다. 환수 검토는 병렬 후속업무다.
 */
export function terminationClawbackReview(
  r: TerminationClawbackRow,
  clawbacks: readonly { code?: string }[],
): TerminationClawbackReview {
  if (!r.contractTerminatedAt) return 'NONE';

  const recorded = clawbacks.some((c) => reviewText(c.code) === r.id);
  const decision = reviewText(r.contractClawbackReviewDecision);
  const reviewedAt = Number(r.contractClawbackReviewedAt ?? 0);
  const reason = reviewText(r.contractClawbackReviewReason);
  const operationId = reviewText(r.contractClawbackReviewOperationId);
  const hasReviewFact = !!decision || reviewedAt > 0 || !!reason || !!operationId;

  if (recorded) {
    if (decision === 'NOT_REQUIRED') return 'INCONSISTENT';
    return 'RECORDED';
  }
  if (!hasReviewFact) return 'PENDING';
  if (!['REQUIRED', 'NOT_REQUIRED'].includes(decision)
    || !Number.isFinite(reviewedAt) || reviewedAt <= 0
    || !reason
    || !OP.test(operationId)) return 'INCONSISTENT';
  return decision as TerminationClawbackDecision;
}

/**
 * 환수 검토 확정 command.
 * 금액을 계산하거나 환수를 생성하지 않는다. «필요/없음» 판단 사실만 원장에 남길 patch를 낸다.
 * 실제 persistence/audit는 I repository가 이 patch를 atomic하게 저장한다.
 */
export function planTerminationClawbackReview(
  r: TerminationClawbackRow,
  clawbacks: readonly { code?: string }[],
  input: TerminationClawbackReviewInput,
  nowMs: number,
): TerminationClawbackReviewPlan {
  if (!r.contractTerminatedAt) {
    return { ok: false, error: '계약해지된 건만 환수 여부를 검토할 수 있습니다' };
  }
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: '환수 검토 사유를 적어야 합니다' };
  const operationId = input.operationId.trim();
  if (!OP.test(operationId)) return { ok: false, error: '환수 검토 요청 식별자가 올바르지 않습니다' };
  if (!Number.isFinite(nowMs) || nowMs <= 0) return { ok: false, error: '환수 검토 처리 시각이 올바르지 않습니다' };

  const state = terminationClawbackReview(r, clawbacks);
  if (state === 'RECORDED') {
    return { ok: false, error: '이미 이 계약의 환수가 등록되어 있습니다 — 기존 환수를 확인해 주세요' };
  }
  if (state === 'INCONSISTENT') {
    return { ok: false, error: '기존 환수 검토 기록이 일치하지 않습니다 — 데이터를 먼저 확인해 주세요' };
  }
  if (state === 'REQUIRED' || state === 'NOT_REQUIRED') {
    const sameOperation = reviewText(r.contractClawbackReviewOperationId) === operationId;
    const sameDecision = reviewText(r.contractClawbackReviewDecision) === input.decision;
    const sameReason = reviewText(r.contractClawbackReviewReason) === reason;
    if (sameOperation && sameDecision && sameReason) return { ok: true, idempotent: true, patch: {} };
    return { ok: false, error: '이미 환수 검토가 확정되어 있습니다 — 기존 검토 기록을 확인해 주세요' };
  }

  return {
    ok: true,
    idempotent: false,
    patch: {
      contractClawbackReviewDecision: input.decision,
      contractClawbackReviewedAt: nowMs,
      contractClawbackReviewReason: reason,
      contractClawbackReviewOperationId: operationId,
    },
  };
}

export type TerminationClawbackFollowUp = 'NONE' | 'REVIEW' | 'RECORD_CLAWBACK' | 'DATA_CHECK';

/**
 * 정산의 다음 단계와 섞지 않는 병렬 후속업무.
 * UI는 blockOf/정산 다음행동을 그대로 유지하면서 이 값을 별도 attention/action으로 표시한다.
 */
export function terminationClawbackFollowUp(
  r: TerminationClawbackRow,
  clawbacks: readonly { code?: string }[],
): TerminationClawbackFollowUp {
  const state = terminationClawbackReview(r, clawbacks);
  if (state === 'PENDING') return 'REVIEW';
  if (state === 'REQUIRED') return 'RECORD_CLAWBACK';
  if (state === 'INCONSISTENT') return 'DATA_CHECK';
  return 'NONE';
}

export function pendingTerminationClawbackRows<T extends TerminationClawbackRow>(
  rows: readonly T[],
  clawbacks: readonly { code?: string }[],
): T[] {
  return rows
    .filter((r) => {
      const state = terminationClawbackReview(r, clawbacks);
      return state === 'PENDING' || state === 'REQUIRED';
    })
    .sort((a, b) =>
      String(b.contractTerminationDate ?? '').localeCompare(String(a.contractTerminationDate ?? ''))
      || a.id.localeCompare(b.id));
}

export interface ClawbackInput { at: string; supplierAmt: number | null; agentAmt: number | null; reason: string }

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const clawbackId = (plate: unknown, month: string, code?: unknown) => {
  const p = String(plate ?? '').trim().replace(/[.$#[\]/\s]/g, '_');
  const c = String(code ?? '').trim().replace(/[.$#[\]/\s]/g, '_');
  return c ? `${p}_${month}_${c}` : `${p}_${month}`;
};

export function clawbackRecord(r: SettlementRow, x: ClawbackInput, by: string, nowMs: number):
  { ok: true; id: string; doc: Record<string, unknown> } | { ok: false; error: string } {
  if (!r.plate) return { ok: false, error: '차량번호가 없는 줄은 환수를 세울 수 없습니다' };
  if (!r.progress.delivered) return { ok: false, error: '인도 전 줄입니다 — 실적이 안 선 줄은 환수할 것이 없습니다(취소로)' };
  if (!DAY.test(x.at)) return { ok: false, error: '환수일은 YYYY-MM-DD' };
  if (!x.reason.trim()) return { ok: false, error: '환수 사유를 적어야 합니다 — 사유 없는 돈은 다음 달에 아무도 못 읽는다' };
  const s = x.supplierAmt ?? 0, a = x.agentAmt ?? 0;
  if (![s, a].every((v) => Number.isFinite(v) && v >= 0)) return { ok: false, error: '환수 금액을 읽지 못했습니다' };
  if (!s && !a) return { ok: false, error: '공급사 환수·영업채널 환수 중 하나는 있어야 합니다' };
  const supplierSettled = r.progress.collected || r.claimStage === '수금';
  const channelSettled = r.progress.paid || r.payStage === '지급';
  if (s && !supplierSettled) return { ok: false, error: '공급사 수금이 끝나지 않은 줄은 공급사 환수할 수 없습니다 — 먼저 정산 상태를 확인합니다' };
  if (a && !channelSettled) return { ok: false, error: '영업채널 지급이 끝나지 않은 줄은 영업채널 환수할 수 없습니다 — 먼저 정산 상태를 확인합니다' };
  const month = x.at.slice(0, 7);
  return {
    ok: true,
    id: clawbackId(r.plate, month, r.id),
    doc: {
      plate: r.plate, model: r.model ?? '', at: x.at, month,
      supplierAmt: Math.round(s), agentAmt: Math.round(a), reason: x.reason.trim(),
      supplier: r.supplier ?? '', channel: r.channel ?? '',
      /* ★어느 줄의 환수인지 — 기존 23건에는 없던 칸이다(차번만 있었다). 재계약이면 차번만으로는 못 가른다 */
      code: r.id, receivedAt: r.receivedAt ?? '',
      ...(r.contractTerminatedAt ? {
        source: 'CONTRACT_TERMINATION',
        contractId: r.contractTerminationContractId ?? r.esignContractId ?? '',
        contractTerminatedAt: r.contractTerminatedAt,
        contractTerminationDate: r.contractTerminationDate ?? '',
        contractTerminationReason: r.contractTerminationReason ?? '',
      } : {}),
      by, updatedAt: nowMs,
    },
  };
}
