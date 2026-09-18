/**
 * **정산관리 — 청구목록 · 지급목록.** 대표 2026-09-18 「정산=청구 / 지급 보려고 하는거고」
 *   · 「실적들어가면 청구목록 지급목록 이렇게 2개가 있어」
 *
 * ★화면을 모른다. 무엇이 어느 목록에 서고 얼마인지만 센다 — 화면과 셈이 «같은 함수» 를 쓴다.
 *
 * 어느 줄이 서나
 *   실적(인도 O · 취소 X) 이고 정산 제외가 아닌 줄. 달은 ERP5 `billMonth` 로 가른다.
 *   ⚠ `billMonth` 가 빈 실적은 「달 모름」 으로 따로 세운다 — 어느 달에도 안 넣고 숨기지도 않는다.
 * 청구목록 = 공급사별 (받을 곳) · 지급목록 = 영업채널별 (줄 곳)
 */
import { isPerformance, type Maybe, type SettlementRow } from './types';

export const NO_MONTH = '달 모름';

export interface LedgerGroup {
  party: string;           // 공급사 또는 영업채널
  rows: SettlementRow[];
  /** 합 — ★모르는 금액(null)은 더하지 않고 따로 센다. 0 으로 세면 합이 거짓말을 한다 */
  total: number;
  unknown: number;
  /** 청구목록: 청구서 보냄 · 지급목록: 통보(지급 확정) */
  done: number;
  hold: number;
}

export const monthOf = (r: SettlementRow) => r.progress.billMonth ?? NO_MONTH;

export function ledgerMonths(rows: readonly SettlementRow[]): string[] {
  const m = new Set<string>();
  for (const r of rows) if (isPerformance(r) && !r.progress.settleExclude) m.add(monthOf(r));
  return [...m].sort((a, b) => (a === NO_MONTH ? 1 : b === NO_MONTH ? -1 : b.localeCompare(a)));
}

function group(
  rows: readonly SettlementRow[], month: string,
  partyOf: (r: SettlementRow) => Maybe<string>,
  amountOf: (r: SettlementRow) => Maybe<number>,
  doneOf: (r: SettlementRow) => boolean,
): LedgerGroup[] {
  const by = new Map<string, LedgerGroup>();
  for (const r of rows) {
    if (!isPerformance(r) || r.progress.settleExclude) continue;
    if (monthOf(r) !== month) continue;
    const party = partyOf(r) ?? '(이름 없음)';
    const g = by.get(party) ?? { party, rows: [], total: 0, unknown: 0, done: 0, hold: 0 };
    g.rows.push(r);
    const a = amountOf(r);
    if (a === null) g.unknown += 1; else g.total += a;   /* ★적힌 금액 그대로 — 비율을 또 곱하지 않는다(적힌 값에 이미 들었는지 모른다) */
    if (doneOf(r)) g.done += 1;
    if (r.progress.billHold) g.hold += 1;
    by.set(party, g);
  }
  for (const g of by.values()) g.rows.sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt)));
  return [...by.values()].sort((a, b) => b.total - a.total || a.party.localeCompare(b.party));
}

/** 청구목록 — 공급사에게 받을 것. 끝남 = 청구서를 보냈다(`billed`). */
export const claimLedger = (rows: readonly SettlementRow[], month: string) =>
  group(rows, month, (r) => r.supplier, (r) => r.money.claim, (r) => r.progress.billed);

/** 지급목록 — 영업채널에 줄 것. 끝남 = 지급 단계가 「통보」 다(ERP5 `payStage`). */
export const payLedger = (rows: readonly SettlementRow[], month: string) =>
  group(rows, month, (r) => r.channel, (r) => r.money.pay, (r) => r.payStage === '통보');

export function ledgerTotals(groups: readonly LedgerGroup[]) {
  return groups.reduce(
    (t, g) => ({ rows: t.rows + g.rows.length, total: t.total + g.total, unknown: t.unknown + g.unknown, done: t.done + g.done }),
    { rows: 0, total: 0, unknown: 0, done: 0 },
  );
}
