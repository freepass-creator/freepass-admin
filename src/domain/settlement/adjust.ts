/**
 * **프로모션 · 가감** — 수수료표 셈 «위에» 사람이 얹는 두 가지.
 *
 * ★대표 2026-09-18 「앞으로는 수수료 대로 계산하고 프로모션이나 가감할수 있는 기능정도만 만들어 두면 됨」
 *
 *   수수료표 셈     기계가 낸다(ERP5 settlement_fee_rules) — claimWritten · payWritten
 *   프로모션        공급사가 «더 주는» 돈 + 그중 영업자 몫 (대표 2026-09-17 「기본 100%」)
 *                   → claimIncentive · payIncentive  ★erp4 claimOf/payOf 가 이미 더하는 칸이다(F04 공급사/에이전시인센티브)
 *   가감            그 밖에 «이 건만» 더하거나 빼는 돈 — ★사유가 없으면 안 받는다
 *                   → claimAdjust · payAdjust · adjustReason (ERP5 새 원자)
 *
 * ⚠ `supplierFixAmt`·`channelFixAmt` 는 가감이 «아니다» — 상대가 확인하며 요청한 «정정 금액» 이다
 *   (erp4 settlement-atom 「공급사 정정금액」 · 실측: 정정금액 3,783,000 = 청구액 3,783,000). 더하면 두 배가 된다.
 *
 * 금액이 서는 식 (한 곳 — ledgers.ts claimAmountOf/payAmountOf)
 *   받을 돈 = (수수료 + 프로모션) × 정산비율 + 가감
 *   줄 돈   = (지급   + 프로모션 영업자 몫) × 정산비율 + 가감
 *   ★가감은 비율을 안 곱한다 — «이 건에서 이만큼» 이라고 사람이 적은 최종 금액이다.
 */
import { promotionFromInput, splitPromotion, type Promotion } from './promotion';

export interface Adjustment {
  /** 공급사 청구에 더하거나(+) 빼는(−) 돈 */
  claim: number;
  /** 영업채널 지급에 더하거나(+) 빼는(−) 돈 */
  pay: number;
  reason: string;
}

const money = (raw: unknown): number | null => {
  const t = String(raw ?? '').replace(/[,\s원]/g, '');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/** 가감 읽기 — ★금액이 있으면 사유가 있어야 한다. 사유 없는 돈은 다음 달에 아무도 못 읽는다 */
export function adjustmentFromInput(claimRaw: unknown, payRaw: unknown, reasonRaw: unknown):
  { ok: true; adjust: Adjustment } | { ok: false; error: string } {
  const claim = money(claimRaw), pay = money(payRaw);
  if (claim === null || pay === null) return { ok: false, error: '가감 금액을 읽지 못했습니다 — 숫자로 넣습니다(빼는 돈은 −)' };
  const reason = String(reasonRaw ?? '').trim();
  if ((claim || pay) && !reason) return { ok: false, error: '가감 사유를 넣어야 합니다' };
  return { ok: true, adjust: { claim, pay, reason } };
}

/** ERP5 에 쓸 칸 — 프로모션 */
export function promotionPatch(p: Promotion): Record<string, unknown> {
  const s = splitPromotion(p);
  return {
    claimIncentive: s.claim,
    payIncentive: s.pay,
    promoShare: p.amount ? p.agentShare : null,
    promoReason: p.amount ? (p.reason ?? '') : '',
  };
}

/** ERP5 에 쓸 칸 — 가감 */
export const adjustPatch = (a: Adjustment): Record<string, unknown> =>
  ({ claimAdjust: a.claim, payAdjust: a.pay, adjustReason: a.claim || a.pay ? a.reason : '' });

export { promotionFromInput };

/**
 * **접수 뒤 수수료 고치기** — 「금액 모름」 줄에 넣거나, 표와 다르게 정해진 금액으로 바꾼다.
 * ★사유가 있어야 한다 · 청구서가 나간 줄의 청구, 지급명세가 나간 줄의 지급은 못 바꾼다(나간 종이와 갈린다 — 가감·이월로).
 */
export function feeFixPatch(
  cur: Record<string, unknown>, claim: number | null, pay: number | null, reason: string,
): { ok: true; patch: Record<string, unknown>; events: { field: string; from: string; to: string }[] } | { ok: false; error: string } {
  if (cur.cancelled === true) return { ok: false, error: '취소된 줄입니다' };
  if (!reason.trim()) return { ok: false, error: '수수료를 고치는 사유를 적어야 합니다' };
  for (const [k, v] of [['청구', claim], ['지급', pay]] as const) if (v !== null && (!Number.isFinite(v) || v < 0)) return { ok: false, error: `${k} 수수료 값을 읽지 못했습니다` };
  const patch: Record<string, unknown> = {};
  const events: { field: string; from: string; to: string }[] = [];
  if (claim !== null && Number(cur.claimWritten ?? 0) !== claim) {
    if (cur.billed === true) return { ok: false, error: '청구서가 나간 줄입니다 — 청구 쪽은 가감이나 다음 달 이월로' };
    patch.claimWritten = Math.round(claim); patch.supplierRate = 0;
    events.push({ field: '청구금액', from: String(cur.claimWritten ?? ''), to: String(Math.round(claim)) });
  }
  if (pay !== null && Number(cur.payWritten ?? 0) !== pay) {
    if (['통보', '확인', '지급'].includes(String(cur.payStage ?? '')) || cur.paid === true) return { ok: false, error: '지급명세가 나간 줄입니다 — 지급 쪽은 가감이나 다음 달 이월로' };
    patch.payWritten = Math.round(pay); patch.agentRate = 0;
    events.push({ field: '지급액', from: String(cur.payWritten ?? ''), to: String(Math.round(pay)) });
  }
  if (!events.length) return { ok: true, patch: {}, events: [] };
  const note = [String(cur.settleNote ?? '').trim(), `[수수료 고침] ${reason.trim()}`].filter(Boolean).join(' / ');
  patch.settleNote = note;
  events.push({ field: '수수료 사유', from: '', to: reason.trim() });
  return { ok: true, patch, events };
}
