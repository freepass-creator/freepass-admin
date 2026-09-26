import { contractPaymentStateOf } from './payment';

export type ContractCancellationInput = {
  reason: string;
  operationId: string;
};

export type ContractCancellationPlan =
  | { ok: true; idempotent: boolean; patch: Record<string, unknown>; intakePatch: Record<string, unknown> }
  | { ok: false; error: string };

const S=(v:unknown)=>String(v??'').trim();
const B=(v:unknown)=>v===true||v==='true'||v==='TRUE'||v==='Y'||v==='참'||v===1;

const settlementStarted=(raw:Record<string,unknown>)=>{
  const claimStage=S(raw.claimStage)||'접수';
  const payStage=S(raw.payStage)||'접수';
  const legacyStage=S(raw.stage);
  const legacyFinancialStage=['청구','통보','정정','확인','수금','지급','정산','정산완료','마감'].includes(legacyStage);
  const datedOrNumbered=[
    raw.billMonth,raw.billedAt,raw.invoiceAt,raw.collectedAt,raw.paidAt,
    raw.invoiceNoS,raw.invoiceNoP,
  ].some(v=>!!S(v));
  return B(raw.billed)||B(raw.invoiceIssued)||B(raw.collected)||B(raw.paid)
    || B(raw.supplierOk)||B(raw.channelOk)||B(raw.supplierFix)||B(raw.channelFix)
    || B(raw.settledAlready)||datedOrNumbered||legacyFinancialStage
    || claimStage!=='접수'||payStage!=='접수'
    || Number(raw.collectedAmt??0)>0||Number(raw.paidAmt??0)>0;
};

export function planContractCancellation(
  contract: Record<string, unknown>,
  intake: Record<string, unknown>,
  input: ContractCancellationInput,
  nowMs: number,
): ContractCancellationPlan {
  const reason=input.reason.trim();
  if(!reason)return {ok:false,error:'계약 취소 사유를 적어 주세요.'};
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(input.operationId)){
    return {ok:false,error:'계약취소 요청 식별자가 올바르지 않습니다.'};
  }

  if(Number(intake.contractTerminatedAt??0)>0||S(contract.contract_status)==='계약해지'){
    return {ok:false,error:'계약해지된 건은 계약취소로 바꿀 수 없습니다.'};
  }
  if(B(intake.delivered)||S(intake.deliveredAt)){
    return {ok:false,error:'이미 인도된 계약은 계약취소가 아니라 계약해지 절차로 처리합니다.'};
  }
  if(settlementStarted(intake)){
    return {ok:false,error:'정산 흔적이 있는 계약은 계약취소할 수 없습니다 — 데이터 상태를 확인해 주세요.'};
  }

  const cancelledAt=Number(intake.contractCancelledAt??0);
  if(cancelledAt>0||S(contract.contract_status)==='계약취소'){
    const sameOperation=S(intake.contractCancellationOperationId)===input.operationId;
    const sameReason=S(intake.contractCancellationReason)===reason;
    if(sameOperation&&sameReason)return {ok:true,idempotent:true,patch:{},intakePatch:{}};
    return {ok:false,error:'이미 계약취소 처리된 계약입니다 — 기존 취소 기록을 확인해 주세요.'};
  }

  const payment=contractPaymentStateOf(intake);
  if(payment.state==='INCONSISTENT'){
    return {ok:false,error:`계약금 수납 기록이 불완전합니다 — ${payment.reason}`};
  }
  if(payment.state==='NONE'){
    return {ok:false,error:'계약금 수납 전은 계약취소가 아니라 접수취소로 처리합니다.'};
  }

  return {
    ok:true,
    idempotent:false,
    patch:{
      contract_status:'계약취소',
      contract_cancelled_at:nowMs,
      contract_cancel_reason:reason,
      contract_cancel_operation_id:input.operationId,
      updated_at:nowMs,
    },
    intakePatch:{
      cancelled:true,
      settleExclude:true,
      contractCancelledAt:nowMs,
      contractCancellationReason:reason,
      contractCancellationOperationId:input.operationId,
      updatedAt:nowMs,
      stateAt:new Date(nowMs).toISOString(),
    },
  };
}
