/**
 * **정산관리 — 청구목록 · 지급목록.** 대표 2026-09-18 「정산=청구 / 지급 보려고 하는거고」
 *   · 「실적들어가면 청구목록 지급목록 이렇게 2개가 있어」
 *
 * ★화면을 모른다. 무엇이 어느 목록에 서고 얼마인지만 센다 — 화면과 셈이 «같은 함수» 를 쓴다.
 * ★★셈은 erp4 와 «같다» — 대표 2026-09-18 「기능적으로 정산 계약쪽 문제 없나??」 로 대 보니 셋이 달랐다.
 *   ① 달      erp4 `settlementMonthOf` — 박힌 청구월 > 분납(접수월+회차−1) > 인도월 > 인도 전은 접수월(예정)
 *             (전에는 박힌 청구월만 보고 인도 전 줄을 뺐다 — 사장님 09-08 「접수되면 청구서에 미리 올라가 있는 거지」)
 *   ② 금액    erp4 `claimOf`/`payOf` — (적힌 금액 + 인센티브) × 정산비율 · 제외·보류·대상 가름
 *             (전에는 인센티브=무보증 수수료를 빠뜨렸다)
 *   ③ 환수    `settlement_clawbacks` 를 그 달·그 상대에서 뺀다 — 환수는 «반대 부호의 한 줄»
 *
 * 청구목록 = 공급사별 (받을 곳) · 지급목록 = 영업채널별 (줄 곳)
 */
import { settlementMonthOf, type MonthBasis } from './month';
import type { Maybe, SettlementRow } from './types';

export const NO_MONTH = '달 모름';

export interface Clawback {
  plate: string; month: string; supplier: string; channel: string;
  supplierAmt: number; agentAmt: number; reason: string; at: string;
}

export interface LedgerLine { row: SettlementRow; month: string; basis: MonthBasis | null; amount: Maybe<number> }

export interface LedgerGroup {
  party: string;           // 공급사 또는 영업채널
  lines: LedgerLine[];
  /** 옛 이름 — lines 의 row 만. ★화면이 아직 이걸 쓴다(지우지 않는다) */
  rows: SettlementRow[];
  /** 합 — ★모르는 금액은 더하지 않고 따로 센다. 0 으로 세면 합이 거짓말을 한다 */
  total: number;
  unknown: number;
  /** 청구목록: 청구서 보냄 · 지급목록: 통보(지급 확정) */
  done: number;
  /** 청구 보류 — 금액에 안 넣는다(erp4 claimOf) */
  hold: number;
  /** 인도 전이라 «예정» 으로 선 줄 */
  forecast: number;
  clawbacks: Clawback[];
  clawbackTotal: number;
  /** 합 − 환수 */
  net: number;
}

const monthOfRow = (r: SettlementRow) => {
  const m = settlementMonthOf({ billMonth: r.progress.billMonth, receivedAt: r.receivedAt, deliveredAt: r.progress.deliveredAt, payKind: r.payKind });
  return { month: m?.month ?? NO_MONTH, basis: m?.basis ?? null };
};

/** 목록에 설 수 있나 — 취소·정산 제외는 어느 목록에도 안 선다 */
const inLedger = (r: SettlementRow) => !r.progress.cancelled && !r.progress.settleExclude;

/** erp4 claimOf — ★적힌 금액을 «모르면»(null) 모름으로 둔다(안 끝난 줄의 0 — to-settlement claimOf) */
export function claimAmountOf(r: SettlementRow): Maybe<number> {
  if (r.progress.billHold) return 0;
  if (r.money.claim === null) return null;
  /* ★가감은 비율을 안 곱한다 — 사람이 «이 건에서 이만큼» 이라고 적은 최종 금액이다 (adjust.ts) */
  return Math.round((r.money.claim + (r.money.claimIncentive ?? 0)) * (r.settleRatio || 1)) + (r.money.claimAdjust ?? 0);
}
export function payAmountOf(r: SettlementRow): Maybe<number> {
  if (r.money.pay === null) return null;
  return Math.round((r.money.pay + (r.money.payIncentive ?? 0)) * (r.settleRatio || 1)) + (r.money.payAdjust ?? 0);
}

export function ledgerMonths(rows: readonly SettlementRow[], clawbacks: readonly Clawback[] = []): string[] {
  const m = new Set<string>();
  for (const r of rows) if (inLedger(r)) m.add(monthOfRow(r).month);
  for (const c of clawbacks) if (c.month) m.add(c.month);
  return [...m].sort((a, b) => (a === NO_MONTH ? 1 : b === NO_MONTH ? -1 : b.localeCompare(a)));
}

function group(
  rows: readonly SettlementRow[], clawbacks: readonly Clawback[], month: string,
  side: 'claim' | 'pay',
): LedgerGroup[] {
  const by = new Map<string, LedgerGroup>();
  const get = (party: string) => {
    const g = by.get(party) ?? { party, lines: [], rows: [], total: 0, unknown: 0, done: 0, hold: 0, forecast: 0, clawbacks: [], clawbackTotal: 0, net: 0 };
    by.set(party, g);
    return g;
  };
  for (const r of rows) {
    if (!inLedger(r)) continue;
    /* ★정산 대상 가름 — 「영업」 만이면 청구에 안 서고, 「공급」 만이면 지급에 안 선다 (erp4 claimOf/payOf) */
    if (side === 'claim' && r.settleTarget === '영업') continue;
    if (side === 'pay' && r.settleTarget === '공급') continue;
    const { month: m, basis } = monthOfRow(r);
    if (m !== month) continue;
    const g = get((side === 'claim' ? r.supplier : r.channel) ?? '(이름 없음)');
    const amount = side === 'claim' ? claimAmountOf(r) : payAmountOf(r);
    g.lines.push({ row: r, month: m, basis, amount });
    if (amount === null) g.unknown += 1; else g.total += amount;
    if (side === 'claim' ? r.progress.billed : r.payStage === '통보') g.done += 1;
    if (side === 'claim' && r.progress.billHold) g.hold += 1;
    if (basis === 'FORECAST') g.forecast += 1;
  }
  for (const c of clawbacks) {
    if (c.month !== month) continue;
    const amt = side === 'claim' ? c.supplierAmt : c.agentAmt;
    if (!amt) continue;
    const g = get((side === 'claim' ? c.supplier : c.channel) || '(이름 없음)');
    g.clawbacks.push(c);
    g.clawbackTotal += amt;
  }
  for (const g of by.values()) {
    g.net = g.total - g.clawbackTotal;
    g.lines.sort((a, b) => String(a.row.receivedAt).localeCompare(String(b.row.receivedAt)));
    g.rows = g.lines.map((l) => l.row);
  }
  return [...by.values()].sort((a, b) => b.net - a.net || a.party.localeCompare(b.party));
}

/** 청구목록 — 공급사에게 받을 것. 끝남 = 청구서를 보냈다(`billed`). */
export const claimLedger = (rows: readonly SettlementRow[], month: string, clawbacks: readonly Clawback[] = []) =>
  group(rows, clawbacks, month, 'claim');

/** 지급목록 — 영업채널에 줄 것. 끝남 = 지급 단계가 「통보」 다(ERP5 `payStage`). */
export const payLedger = (rows: readonly SettlementRow[], month: string, clawbacks: readonly Clawback[] = []) =>
  group(rows, clawbacks, month, 'pay');

export function ledgerTotals(groups: readonly LedgerGroup[]) {
  return groups.reduce(
    (t, g) => ({
      rows: t.rows + g.lines.length, total: t.total + g.total, unknown: t.unknown + g.unknown, done: t.done + g.done,
      forecast: t.forecast + g.forecast, clawback: t.clawback + g.clawbackTotal, net: t.net + g.net,
    }),
    { rows: 0, total: 0, unknown: 0, done: 0, forecast: 0, clawback: 0, net: 0 },
  );
}
