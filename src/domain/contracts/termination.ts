export type ContractTerminationInput = {
  effectiveDate: string;
  reason: string;
  operationId: string;
};

export type ContractTerminationPlan =
  | { ok: true; idempotent: boolean; patch: Record<string, unknown>; intakePatch: Record<string, unknown> }
  | { ok: false; error: string };

const DAY=/^\d{4}-\d{2}-\d{2}$/;
const S=(v:unknown)=>String(v??'').trim();
const B=(v:unknown)=>v===true||v==='true'||v==='TRUE'||v==='Y'||v===1;

export function planContractTermination(
  contract: Record<string, unknown>,
  intake: Record<string, unknown>,
  input: ContractTerminationInput,
  nowMs: number,
): ContractTerminationPlan {
  const reason=input.reason.trim();
  if(!reason)return {ok:false,error:'계약해지 사유를 적어 주세요.'};
  if(!DAY.test(input.effectiveDate))return {ok:false,error:'계약해지일은 YYYY-MM-DD 입니다.'};
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(input.operationId))return {ok:false,error:'계약해지 요청 식별자가 올바르지 않습니다.'};

  if(B(intake.cancelled)||Number(intake.contractCancelledAt??0)>0||S(contract.contract_status)==='계약취소'){
    return {ok:false,error:'계약취소된 건은 계약해지할 수 없습니다.'};
  }

  const deliveredAt=S(intake.deliveredAt);
  if(!B(intake.delivered)||!DAY.test(deliveredAt)){
    return {ok:false,error:'인도 전 계약은 계약해지가 아니라 계약취소로 처리합니다.'};
  }
  if(input.effectiveDate<deliveredAt){
    return {ok:false,error:`계약해지일은 인도일(${deliveredAt})보다 빠를 수 없습니다.`};
  }

  const terminatedAt=Number(intake.contractTerminatedAt??0);
  if(terminatedAt>0){
    const sameOperation=S(intake.contractTerminationOperationId)===input.operationId;
    const samePayload=S(intake.contractTerminationDate)===input.effectiveDate
      && S(intake.contractTerminationReason)===reason;
    if(sameOperation&&samePayload)return {ok:true,idempotent:true,patch:{},intakePatch:{}};
    return {ok:false,error:'이미 계약해지 처리된 계약입니다 — 기존 해지 기록을 확인해 주세요.'};
  }

  return {
    ok:true,
    idempotent:false,
    patch:{
      contract_status:'계약해지',
      contract_terminated_at:nowMs,
      contract_termination_date:input.effectiveDate,
      contract_termination_reason:reason,
      contract_termination_operation_id:input.operationId,
      updated_at:nowMs,
    },
    intakePatch:{
      contractTerminatedAt:nowMs,
      contractTerminationDate:input.effectiveDate,
      contractTerminationReason:reason,
      contractTerminationOperationId:input.operationId,
      updatedAt:nowMs,
      stateAt:new Date(nowMs).toISOString(),
    },
  };
}
