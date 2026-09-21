/**
 * **정산관리 — 청구목록 · 지급목록.** 대표 2026-09-18 「정산=청구 / 지급 보려고 하는거고」
 *   · 「실적들어가면 청구목록 지급목록 이렇게 2개가 있어」
 *
 * ★화면을 모른다. 무엇이 어느 목록에 서고 얼마인지만 센다 — 화면과 셈이 «같은 함수» 를 쓴다.
 * ★★셈은 erp4 와 «같다» — 대표 2026-09-18 「기능적으로 정산 계약쪽 문제 없나??」 로 대 보니 셋이 달랐다.
 *   ① 달      erp4 settlement-stage `billingMonthIn` — 인도가 관문 · 박힌 청구월 > 일시납 인도월 > 분납 완납월(끊기면 받은 회차 달)
 *             ★대표 2026-09-18 「완납인도기준으로 청구 및 지급」 — 인도 전 줄은 안 선다(전에 «예정» 으로 올렸던 것을 걷었다)
 *             ★박힌 달은 닫혔다 — 계산으로 늦게 오는 줄은 「청구월 미정」 으로
 *   ② 금액    money.ts — (수수료 + 프로모션) × 비율 × 받은 몫 + 가감 · 스타·아이카 끊기면 지급 0
 *   ③ 환수    `settlement_clawbacks` 를 그 달·그 상대에서 뺀다 — 환수는 «반대 부호의 한 줄»
 *
 * 청구목록 = 공급사별 (받을 곳) · 지급목록 = 영업채널별 (줄 곳)
 */
import { billingMonthIn, brokenOf, lockedMonthsOf, paidRatioOf } from './stage';
import type { Maybe, SettlementRow } from './types';

/** 인도는 됐는데 달이 닫혀(박힌 달) 계산으로 못 들어간 줄 — 사람이 달을 정한다 */
export const NO_MONTH = '청구월 미정';

export interface Clawback {
  plate: string; month: string; supplier: string; channel: string;
  supplierAmt: number; agentAmt: number; reason: string; at: string;
  /** 어느 정산 줄의 환수인가 — 어드민에서 세운 것만 있다(옛 23건은 차번뿐) */
  code?: string;
}

export interface LedgerLine {
  row: SettlementRow;
  month: string;
  amount: Maybe<number>;
  /** 분납이 끊겨 받은 만큼만 선 줄 — ratio 는 받은 몫(0~1) */
  broken: boolean;
  ratio: number;
}

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
  /** ⚠ 더 안 쓴다 — 인도 전 «예정» 줄은 목록에 안 선다(대표 2026-09-18 「완납인도기준」). 늘 0 */
  forecast: number;
  /** 분납이 끊겨 받은 만큼만 선 줄 수 */
  broken: number;
  clawbacks: Clawback[];
  clawbackTotal: number;
  /** 합 − 환수 */
  net: number;
}

/**
 * 그 줄의 청구·지급 달. ★인도 전이면 null — 목록에 안 선다(「아직」).
 * 인도됐는데 달이 닫혀 못 들어가면 「청구월 미정」.
 */
function monthOfRow(r: SettlementRow, locked: ReadonlySet<string>, now: Date): string | null {
  const m = billingMonthIn(r, locked, now);
  if (m) return m;
  return r.progress.delivered ? NO_MONTH : null;
}

/** 돈 원장에 설 수 있나 — 취소/제외뿐 아니라 차량 identity와 계약서가 확인돼야 한다. */
const inLedger = (r: SettlementRow) =>
  !r.progress.cancelled && !r.progress.settleExclude && !!r.plate && r.progress.paper;

/* 금액은 한 곳(money.ts)에서 — 목록·상세·남는 것이 같은 셈을 쓴다 */
import { claimAmountOf, payAmountOf } from './money';
export { claimAmountOf, payAmountOf };

export function ledgerMonths(rows: readonly SettlementRow[], clawbacks: readonly Clawback[] = [], now = new Date()): string[] {
  const m = new Set<string>();
  const locked = lockedMonthsOf(rows);
  for (const r of rows) { if (!inLedger(r)) continue; const x = monthOfRow(r, locked, now); if (x) m.add(x); }
  for (const c of clawbacks) if (c.month) m.add(c.month);
  return [...m].sort((a, b) => (a === NO_MONTH ? 1 : b === NO_MONTH ? -1 : b.localeCompare(a)));
}

function group(
  rows: readonly SettlementRow[], clawbacks: readonly Clawback[], month: string,
  side: 'claim' | 'pay', now: Date,
): LedgerGroup[] {
  const by = new Map<string, LedgerGroup>();
  const locked = lockedMonthsOf(rows);
  const get = (party: string) => {
    const g = by.get(party) ?? { party, lines: [], rows: [], total: 0, unknown: 0, done: 0, hold: 0, forecast: 0, broken: 0, clawbacks: [], clawbackTotal: 0, net: 0 };
    by.set(party, g);
    return g;
  };
  for (const r of rows) {
    if (!inLedger(r)) continue;
    /* ★정산 대상 가름 — 「영업」 만이면 청구에 안 서고, 「공급」 만이면 지급에 안 선다 (erp4 claimOf/payOf) */
    if (side === 'claim' && r.settleTarget === '영업') continue;
    if (side === 'pay' && r.settleTarget === '공급') continue;
    const m = monthOfRow(r, locked, now);
    if (m !== month) continue;
    const party = side === 'claim' ? r.supplier : r.channel;
    // 상대가 없는 줄을 「이름 없음」으로 묶어 발행 후보로 만들지 않는다.
    if (!party) continue;
    const g = get(party);
    const amount = side === 'claim' ? claimAmountOf(r, now) : payAmountOf(r, now);
    const broken = brokenOf(r, now);
    g.lines.push({ row: r, month: m, amount, broken, ratio: paidRatioOf(r, now) });
    if (broken) g.broken += 1;
    if (amount === null) g.unknown += 1; else g.total += amount;
    if (side === 'claim' ? r.progress.billed : ['통보', '확인', '지급'].includes(r.payStage)) g.done += 1;
    if (side === 'claim' && r.progress.billHold) g.hold += 1;
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
export const claimLedger = (rows: readonly SettlementRow[], month: string, clawbacks: readonly Clawback[] = [], now = new Date()) =>
  group(rows, clawbacks, month, 'claim', now);

/** 지급목록 — 영업채널에 줄 것. 끝남 = 지급명세가 나갔다(지급 축 통보·확인·지급). */
export const payLedger = (rows: readonly SettlementRow[], month: string, clawbacks: readonly Clawback[] = [], now = new Date()) =>
  group(rows, clawbacks, month, 'pay', now);

export function ledgerTotals(groups: readonly LedgerGroup[]) {
  return groups.reduce(
    (t, g) => ({
      rows: t.rows + g.lines.length, total: t.total + g.total, unknown: t.unknown + g.unknown, done: t.done + g.done,
      forecast: t.forecast + g.forecast, broken: t.broken + g.broken, clawback: t.clawback + g.clawbackTotal, net: t.net + g.net,
    }),
    { rows: 0, total: 0, unknown: 0, done: 0, forecast: 0, broken: 0, clawback: 0, net: 0 },
  );
}
