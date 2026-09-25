export type ContractExitDecision =
  | { kind: 'CANCEL_ALLOWED' }
  | { kind: 'TERMINATION_REQUIRED'; reason: 'DELIVERED' | 'SETTLEMENT_STARTED' };

const B=(v:unknown)=>v===true||v==='true'||v==='TRUE'||v==='Y'||v===1;
const S=(v:unknown)=>String(v??'').trim();

export function contractExitDecision(raw: Record<string, unknown>): ContractExitDecision {
  if (B(raw.delivered) || S(raw.deliveredAt)) {
    return { kind: 'TERMINATION_REQUIRED', reason: 'DELIVERED' };
  }

  const settlementStarted = B(raw.billed)
    || B(raw.invoiceIssued)
    || B(raw.collected)
    || B(raw.paid)
    || B(raw.supplierOk)
    || B(raw.channelOk)
    || Number(raw.collectedAmt ?? 0) > 0
    || Number(raw.paidAmt ?? 0) > 0
    || ['청구','정정','확인','수금'].includes(S(raw.claimStage))
    || ['통보','정정','확인','지급'].includes(S(raw.payStage))
    || !!S(raw.billMonth);

  return settlementStarted
    ? { kind: 'TERMINATION_REQUIRED', reason: 'SETTLEMENT_STARTED' }
    : { kind: 'CANCEL_ALLOWED' };
}
