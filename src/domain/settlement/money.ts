/**
 * **그 줄이 «얼마인가» — 한 곳.**  청구목록·지급목록·접수 상세·남는 것이 모두 이것을 쓴다.
 *
 *   받을 돈 = (수수료 + 프로모션) × 정산비율 + 가감      ← erp4 claimOf + 가감(대표 2026-09-18)
 *   줄 돈   = (지급   + 프로모션 영업자 몫) × 정산비율 + 가감
 *   남는 것 = 받을 돈 − 줄 돈
 *
 * ★모르는 금액(null)은 모른다 — 0 으로 세지 않는다. 청구 보류면 받을 돈 0.
 * ★가감은 비율을 안 곱한다 — 사람이 «이 건에서 이만큼» 이라고 적은 최종 금액이다.
 * ⚠ 정산대상(양쪽·공급·영업) 가름은 «목록» 의 일이다(ledgers.ts) — 한 줄의 금액은 대상과 무관하게 선다.
 */
import type { Maybe, SettlementRow } from './types';

export function claimAmountOf(r: SettlementRow): Maybe<number> {
  if (r.progress.billHold) return 0;
  if (r.money.claim === null) return null;
  return Math.round((r.money.claim + (r.money.claimIncentive ?? 0)) * (r.settleRatio || 1)) + (r.money.claimAdjust ?? 0);
}

export function payAmountOf(r: SettlementRow): Maybe<number> {
  if (r.money.pay === null) return null;
  return Math.round((r.money.pay + (r.money.payIncentive ?? 0)) * (r.settleRatio || 1)) + (r.money.payAdjust ?? 0);
}

/** 남는 것. ★받을 돈을 «모르면» 남는 것도 모른다 */
export function marginOf(r: SettlementRow): Maybe<number> {
  const c = claimAmountOf(r);
  if (c === null) return null;
  return c - (payAmountOf(r) ?? 0);
}
