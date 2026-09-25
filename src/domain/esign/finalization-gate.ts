const S=(v:unknown)=>String(v??'').trim();
const B=(v:unknown)=>v===true||v==='true'||v==='TRUE'||v==='Y'||v==='참'||v===1;

export function finalizationBlockReason(
  contract: Record<string, unknown>,
  intake: Record<string, unknown> | null,
): string | null {
  const contractStatus=S(contract.contract_status);
  const cancelled=contractStatus==='계약취소'
    || !!intake && (B(intake.cancelled) || Number(intake.contractCancelledAt??0)>0);
  if(cancelled)return '계약취소된 계약은 전자서명 승인할 수 없습니다.';

  const terminated=contractStatus==='계약해지'
    || !!intake && Number(intake.contractTerminatedAt??0)>0;
  if(terminated)return '계약해지된 계약은 전자서명 승인할 수 없습니다.';

  return null;
}
