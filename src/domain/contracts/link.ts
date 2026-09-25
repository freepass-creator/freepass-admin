const S=(v:unknown)=>String(v??'').trim();

export function contractIntakeLinkError(
  contractId: string,
  intake: Record<string, unknown> | null,
): string | null {
  if(!intake)return null;
  const linked=S(intake.esignContractId);
  if(linked && linked!==contractId){
    return `접수가 다른 계약(${linked})에 연결되어 있습니다 — 계약/접수 연결을 확인해 주세요.`;
  }
  return null;
}
