import type { SettlementRow } from './types';
import { isCalendarDay } from './calendar';

export type WorkflowConsistencyCode =
  | 'CANCELLED_AND_DELIVERED'
  | 'CANCELLED_AND_TERMINATED'
  | 'CONTRACT_CANCELLED_NOT_EXCLUDED'
  | 'TERMINATED_NOT_DELIVERED'
  | 'TERMINATED_AND_CANCELLED'
  | 'DELIVERY_DATE_INVALID'
  | 'DELIVERY_BEFORE_INTAKE'
  | 'FINANCIAL_ACTIVITY_BEFORE_DELIVERY'
  | 'INVOICE_WITHOUT_BILL'
  | 'COLLECTED_STAGE_MISMATCH'
  | 'PAID_STAGE_MISMATCH'
  | 'BILL_HOLD_AFTER_BILL';

export interface WorkflowConsistencyIssue {
  code: WorkflowConsistencyCode;
  message: string;
}

/**
 * Legacy row를 읽을 때 자동으로 사실을 고치지 않는다.
 * 여기서는 업무적으로 동시에 참일 수 없는 조합만 잡는다.
 * 새 mutation은 이 목록이 비어 있을 때만 진행한다.
 */
export function workflowConsistencyIssues(
  r: Pick<
    SettlementRow,
    'receivedAt' | 'contractCancelledAt' | 'contractTerminatedAt' | 'progress' | 'claimStage' | 'payStage'
  >,
): WorkflowConsistencyIssue[] {
  const issues: WorkflowConsistencyIssue[] = [];
  const p = r.progress;
  const add = (code: WorkflowConsistencyCode, message: string) => issues.push({ code, message });

  if (p.cancelled && p.delivered) {
    add('CANCELLED_AND_DELIVERED', '취소와 인도완료가 동시에 기록되어 있습니다');
  }
  if (r.contractCancelledAt && r.contractTerminatedAt) {
    add('CANCELLED_AND_TERMINATED', '계약취소와 계약해지가 동시에 기록되어 있습니다');
  }
  if (r.contractCancelledAt && (!p.cancelled || !p.settleExclude)) {
    add('CONTRACT_CANCELLED_NOT_EXCLUDED', '계약취소 기록과 접수취소/정산제외 상태가 일치하지 않습니다');
  }
  if (r.contractTerminatedAt && !p.delivered) {
    add('TERMINATED_NOT_DELIVERED', '계약해지 기록이 있는데 인도완료 사실이 없습니다');
  }
  if (r.contractTerminatedAt && p.cancelled) {
    add('TERMINATED_AND_CANCELLED', '계약해지 건이 일반 취소 상태로도 표시되어 있습니다');
  }

  if (p.delivered) {
    if (!isCalendarDay(p.deliveredAt)) {
      add('DELIVERY_DATE_INVALID', '인도완료인데 유효한 인도일이 없습니다');
    } else if (isCalendarDay(r.receivedAt) && String(p.deliveredAt) < String(r.receivedAt)) {
      add('DELIVERY_BEFORE_INTAKE', '인도일이 접수일보다 빠릅니다');
    }
  }

  const financialActivity =
    p.billed || p.invoiceIssued || p.collected || p.paid
    || (p.collectedAmt ?? 0) > 0 || (p.paidAmt ?? 0) > 0
    || r.claimStage !== '접수' || r.payStage !== '접수';
  if (!p.delivered && financialActivity) {
    add('FINANCIAL_ACTIVITY_BEFORE_DELIVERY', '인도 전인데 청구·지급·수금 등 정산 진행 기록이 있습니다');
  }
  if (p.invoiceIssued && !p.billed) {
    add('INVOICE_WITHOUT_BILL', '청구서 발행 없이 계산서 완료가 기록되어 있습니다');
  }
  if (p.collected && r.claimStage !== '수금') {
    add('COLLECTED_STAGE_MISMATCH', '수금완료와 공급사 정산 단계가 일치하지 않습니다');
  }
  if (p.paid && r.payStage !== '지급') {
    add('PAID_STAGE_MISMATCH', '지급완료와 영업채널 정산 단계가 일치하지 않습니다');
  }
  if (p.billHold && p.billed) {
    add('BILL_HOLD_AFTER_BILL', '청구보류와 청구서 발행이 동시에 기록되어 있습니다');
  }

  return issues;
}

export function workflowMutationBlockedReason(
  r: Parameters<typeof workflowConsistencyIssues>[0],
): string | null {
  const issues = workflowConsistencyIssues(r);
  if (!issues.length) return null;
  return `업무 상태가 서로 맞지 않습니다 — ${issues.map((x) => x.message).join(' · ')}`;
}
