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
const B=(v:unknown)=>v===true||v==='true'||v==='TRUE'||v==='Y'||v==='참'||v===1;
const roundsOf=(payKind:unknown)=>{const m=/(\d+)\s*회/.exec(S(payKind));const n=m?Number(m[1]):1;return n>=2?n:1;};

// Reject calendar overflow (for example, February 30) instead of normalizing it.
function isCalendarDay(value: string): boolean {
  if(!DAY.test(value)||Number(value.slice(0,4))<1)return false;
  const ms=Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value;
}

export function planContractTermination(
  contract: Record<string, unknown>,
  intake: Record<string, unknown>,
  input: ContractTerminationInput,
  nowMs: number,
): ContractTerminationPlan {
  const reason=input.reason.trim();
  if(!reason)return {ok:false,error:'계약해지 사유를 적어 주세요.'};
  if(!isCalendarDay(input.effectiveDate))return {ok:false,error:'계약해지일은 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.'};
  const now=new Date(nowMs);
  const localNow=new Date(nowMs+9*3600_000);
  if(!Number.isFinite(nowMs)||!Number.isFinite(now.getTime())||!Number.isFinite(localNow.getTime())){
    return {ok:false,error:'계약해지 처리 시각이 올바르지 않습니다. 다시 시도해 주세요.'};
  }
  const today=localNow.toISOString().slice(0,10);
  if(input.effectiveDate>today)return {ok:false,error:`계약해지일은 오늘(${today})보다 뒤일 수 없습니다.`};
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(input.operationId))return {ok:false,error:'계약해지 요청 식별자가 올바르지 않습니다.'};

  if(S(contract.esign_id) && S(contract.sign_status)!=='서명완료'){
    return {ok:false,error:'전자계약 서명 상태와 인도 상태가 맞지 않습니다 — 계약 상태를 먼저 확인해 주세요.'};
  }

  if(B(intake.cancelled)||Number(intake.contractCancelledAt??0)>0||S(contract.contract_status)==='계약취소'){
    return {ok:false,error:'계약취소된 건은 계약해지할 수 없습니다.'};
  }

  const deliveredAt=S(intake.deliveredAt);
  if(!B(intake.delivered)){
    return {ok:false,error:'인도 전에는 계약해지할 수 없습니다 — 계약금 수납 전이면 접수취소, 수납 후면 계약취소로 처리합니다.'};
  }
  if(!isCalendarDay(deliveredAt)){
    return {ok:false,error:'인도일이 올바르지 않습니다 — 인도 기록을 먼저 확인해 주세요.'};
  }
  if(input.effectiveDate<deliveredAt){
    return {ok:false,error:`계약해지일은 인도일(${deliveredAt})보다 빠를 수 없습니다.`};
  }

  // Termination is mirrored in both contract + source intake. Never trust only one
  // side for idempotency: legacy/manual partial writes must fail closed instead of
  // being silently overwritten by a retry.
  const contractTerminatedAt=Number(contract.contract_terminated_at??0);
  const intakeTerminatedAt=Number(intake.contractTerminatedAt??0);
  const contractHasTermination=S(contract.contract_status)==='계약해지'
    || contractTerminatedAt>0
    || Boolean(S(contract.contract_termination_date))
    || Boolean(S(contract.contract_termination_reason))
    || Boolean(S(contract.contract_termination_operation_id));
  const intakeHasTermination=intakeTerminatedAt>0
    || Boolean(S(intake.contractTerminationDate))
    || Boolean(S(intake.contractTerminationReason))
    || Boolean(S(intake.contractTerminationOperationId));

  const installments=roundsOf(intake.payKind);
  if(installments>=2){
    const raw=intake.paidRounds;
    const paid=raw===undefined||raw===null||S(raw)===''?null:Number(raw);
    if(paid===null){
      return {ok:false,error:'분납 계약해지 전 실제 납입회차를 먼저 확정해 주세요 — 날짜 경과만으로 납입을 추정하지 않습니다.'};
    }
    if(!Number.isInteger(paid)||paid<1||paid>installments){
      return {ok:false,error:`분납 납입회차가 올바르지 않습니다 — 1~${installments}회 사이인지 확인해 주세요.`};
    }
  }

  if(contractHasTermination||intakeHasTermination){
    if(!contractHasTermination||!intakeHasTermination){
      return {ok:false,error:'계약과 접수의 기존 해지 기록이 일치하지 않습니다 — 데이터를 먼저 확인해 주세요.'};
    }
    const mirrored=contractTerminatedAt>0
      && contractTerminatedAt===intakeTerminatedAt
      && S(contract.contract_status)==='계약해지'
      && S(contract.contract_termination_operation_id)===S(intake.contractTerminationOperationId)
      && S(contract.contract_termination_date)===S(intake.contractTerminationDate)
      && S(contract.contract_termination_reason)===S(intake.contractTerminationReason);
    if(!mirrored){
      return {ok:false,error:'계약과 접수의 기존 해지 기록이 일치하지 않습니다 — 데이터를 먼저 확인해 주세요.'};
    }
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
      stateAt:now.toISOString(),
    },
  };
}
