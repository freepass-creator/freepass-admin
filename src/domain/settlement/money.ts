/**
 * **그 줄이 «얼마인가» — 한 곳.**  청구목록·지급목록·접수 상세·남는 것이 모두 이것을 쓴다.
 *
 *   받을 돈 = (수수료 + 프로모션) × 정산비율 × 받은 몫 + 가감      ← erp4 moneyOf + 가감(대표 2026-09-18)
 *   줄 돈   = (지급   + 프로모션 영업자 몫) × 정산비율 × 받은 몫 + 가감
 *   남는 것 = 받을 돈 − 줄 돈
 *
 *   받은 몫 — 분납이 «끊기면» 받은 회차 / 전체 회차 (사장님 2026-09-01 「안된 시점에서 그 청구금액에 맞춰」)
 *             실증: 133호1997 우리캐피탈 1,688,750 × 1/2 = 844,375 (태윤 매니저가 손으로 하던 계산)
 *   ★스타·아이카는 끊기면 지급이 «아예» 없다 — 비례가 아니라 0 (사장님 2026-08-25)
 *
 * ★모르는 금액(null)은 모른다 — 0 으로 세지 않는다. 청구 보류면 받을 돈 0.
 * ★가감은 비율·몫을 안 곱한다 — 사람이 «이 건에서 이만큼» 이라고 적은 최종 금액이다.
 * ⚠ 정산대상(양쪽·공급·영업) 가름은 «목록» 의 일이다(ledgers.ts).
 */
import { noPayIfBroken, paidRatioOf } from './stage';
import type { Maybe, SettlementRow } from './types';

export function claimAmountOf(r: SettlementRow, now = new Date()): Maybe<number> {
  if (r.progress.billHold) return 0;
  if (r.money.claim === null) return null;
  const k = paidRatioOf(r, now) * (r.settleRatio || 1);
  return Math.round((r.money.claim + (r.money.claimIncentive ?? 0)) * k) + (r.money.claimAdjust ?? 0);
}

export function payAmountOf(r: SettlementRow, now = new Date()): Maybe<number> {
  if (r.money.pay === null) return null;
  const ratio = paidRatioOf(r, now);
  if (ratio < 1 && noPayIfBroken(r)) return r.money.payAdjust ?? 0;
  return Math.round((r.money.pay + (r.money.payIncentive ?? 0)) * ratio * (r.settleRatio || 1)) + (r.money.payAdjust ?? 0);
}

/** 남는 것. ★받을 돈을 «모르면» 남는 것도 모른다 */
export function marginOf(r: SettlementRow, now = new Date()): Maybe<number> {
  const c = claimAmountOf(r, now);
  if (c === null) return null;
  return c - (payAmountOf(r, now) ?? 0);
}
