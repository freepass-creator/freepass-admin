import type { SettlementRow } from './types';
import type { ClawbackInput } from './clawback';

export const CLAWBACK_FOLLOWUP_STATES = ['NONE','REQUIRED','COMPLETED'] as const;
export type ClawbackFollowupState = typeof CLAWBACK_FOLLOWUP_STATES[number];

const state = (v: unknown): ClawbackFollowupState | null => {
  const s=String(v??'').trim() as ClawbackFollowupState;
  return CLAWBACK_FOLLOWUP_STATES.includes(s) ? s : null;
};

export function cancellationClawbackRequirement(input: {
  collected?: unknown;
  collectedAmt?: unknown;
  claimStage?: unknown;
  paid?: unknown;
  paidAmt?: unknown;
  payStage?: unknown;
}) {
  const B=(v:unknown)=>v===true||v==='true'||v==='TRUE'||v==='Y'||v===1;
  const supplierMoved=B(input.collected)||Number(input.collectedAmt??0)>0||String(input.claimStage??'').trim()==='수금';
  const channelMoved=B(input.paid)||Number(input.paidAmt??0)>0||String(input.payStage??'').trim()==='지급';
  const supplier:ClawbackFollowupState=supplierMoved?'REQUIRED':'NONE';
  const channel:ClawbackFollowupState=channelMoved?'REQUIRED':'NONE';
  return { supplier, channel, needsClawback:supplier==='REQUIRED'||channel==='REQUIRED' };
}

export function cancellationClawbackStateOf(r: SettlementRow) {
  const fallback=cancellationClawbackRequirement({
    collected:r.progress.collected,
    collectedAmt:r.progress.collectedAmt,
    claimStage:r.claimStage,
    paid:r.progress.paid,
    paidAmt:r.progress.paidAmt,
    payStage:r.payStage,
  });
  return {
    supplier: state(r.contractCancellationSupplierClawbackState) ?? fallback.supplier,
    channel: state(r.contractCancellationChannelClawbackState) ?? fallback.channel,
  };
}

export function validateCancellationClawbackInput(r: SettlementRow, x: ClawbackInput): string | null {
  if (!r.contractCancelledAt) return null;
  const current=cancellationClawbackStateOf(r);
  const supplier=Math.round(Number(x.supplierAmt??0));
  const channel=Math.round(Number(x.agentAmt??0));

  if (current.supplier==='REQUIRED' && supplier<=0) return '공급사 환수 필요 건입니다 — 공급사 환수액을 입력해야 합니다';
  if (current.channel==='REQUIRED' && channel<=0) return '영업채널 환수 필요 건입니다 — 영업채널 환수액을 입력해야 합니다';
  if (current.supplier==='NONE' && supplier>0) return '공급사 환수가 필요하지 않은 계약취소입니다 — 공급사 환수액을 넣지 않습니다';
  if (current.channel==='NONE' && channel>0) return '영업채널 환수가 필요하지 않은 계약취소입니다 — 영업채널 환수액을 넣지 않습니다';
  if (current.supplier==='COMPLETED' || current.channel==='COMPLETED') return '계약취소 환수가 이미 완료된 축이 있습니다 — 기존 환수 기록을 확인합니다';
  return null;
}

export function cancellationClawbackCompletionPatch(r: SettlementRow, x: ClawbackInput): Record<string, unknown> {
  if (!r.contractCancelledAt) return {};
  const current=cancellationClawbackStateOf(r);
  const supplier:ClawbackFollowupState = current.supplier==='REQUIRED' && Number(x.supplierAmt??0)>0 ? 'COMPLETED' : current.supplier;
  const channel:ClawbackFollowupState = current.channel==='REQUIRED' && Number(x.agentAmt??0)>0 ? 'COMPLETED' : current.channel;
  return {
    contractCancellationSupplierClawbackState:supplier,
    contractCancellationChannelClawbackState:channel,
    contractCancellationNeedsClawback:supplier==='REQUIRED'||channel==='REQUIRED',
  };
}
