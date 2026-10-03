/**
 * **접수표** — 엑셀 F04 「접수」 탭을 그대로 옮긴 한 장짜리 원장 화면의 순수한 조각.
 *
 * ★사용자 결정 2026-10-03 「UI UX가 없다고 가정하고 엑셀로 접수 업무 하던 거를 새로」
 *   정산 백데이터도 접수 한 장에 누적한다(2026-10-02). 행을 다른 탭으로 옮기지 않는다.
 * ★저장소는 기존 settlement_rows 그대로 — 여기서는 «보여 줄 꼴» 과 «거르기·합계» 만 정한다.
 * ★모르는 금액(null)은 0 으로 더하지 않는다. 「미확정 n건」 으로 따로 센다.
 */
import type { SettlementRow } from '../../domain/settlement/types';

export interface LedgerRow {
  code: string;
  receivedAt: string;
  plate: string;
  supplier: string;
  model: string;
  channel: string;
  agent: string;
  customer: string;
  product: string;
  term: number | null;
  rent: number | null;
  deposit: number | null;
  price: number | null;
  payKind: string;
  paper: boolean;
  delivered: boolean;
  deliveredAt: string;
  billMonth: string;
  claim: number | null;
  pay: number | null;
  cancelled: boolean;
  note: string;
}

const t = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function toLedgerRow(r: SettlementRow): LedgerRow {
  return {
    code: r.id,
    receivedAt: t(r.receivedAt),
    plate: t(r.plate),
    supplier: t(r.supplier),
    model: t(r.model),
    channel: t(r.channel),
    agent: t(r.agent),
    customer: t(r.customer),
    product: t(r.product),
    term: r.term ?? null,
    rent: r.rent ?? null,
    deposit: r.deposit ?? null,
    price: r.price ?? null,
    payKind: t(r.payKind),
    paper: !!r.progress.paper,
    delivered: !!r.progress.delivered,
    deliveredAt: t(r.progress.deliveredAt),
    billMonth: t(r.progress.billMonth),
    claim: r.money.claim ?? null,
    pay: r.money.pay ?? null,
    cancelled: !!r.progress.cancelled,
    note: t(r.note),
  };
}

/** 최신 접수가 위 — 접수일 내림차순, 같은 날은 코드로 고정(새로고침마다 줄이 흔들리지 않게). */
export function sortLedger(rows: LedgerRow[]): LedgerRow[] {
  return [...rows].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || a.code.localeCompare(b.code));
}

export interface LedgerFilter {
  /** `YYYY-MM` 청구월, `none` = 청구월 빈 줄, `` = 전체 */
  month: string;
  q: string;
  showCancelled: boolean;
}

const SEARCH_KEYS = ['plate', 'customer', 'supplier', 'model', 'channel', 'agent', 'product', 'note'] as const;

export function filterLedger(rows: LedgerRow[], f: LedgerFilter): LedgerRow[] {
  const q = f.q.replace(/\s/g, '').toLowerCase();
  return rows.filter((r) => {
    if (!f.showCancelled && r.cancelled) return false;
    if (f.month === 'none' && r.billMonth) return false;
    if (f.month && f.month !== 'none' && r.billMonth !== f.month) return false;
    if (q && !SEARCH_KEYS.some((k) => r[k].replace(/\s/g, '').toLowerCase().includes(q))) return false;
    return true;
  });
}

/** 청구월 목록 — 최신 달이 위. 빈 청구월은 따로(`none`) 고른다. */
export function billMonthsOf(rows: LedgerRow[]): string[] {
  return [...new Set(rows.map((r) => r.billMonth).filter(Boolean))].sort().reverse();
}

export interface LedgerTotals {
  rows: number;
  claim: number;
  pay: number;
  claimUnknown: number;
  payUnknown: number;
}

/** 합계 — 취소 줄은 금액에 넣지 않는다(목록에 보이더라도). */
export function totalsOf(rows: LedgerRow[]): LedgerTotals {
  const live = rows.filter((r) => !r.cancelled);
  const sum = (k: 'claim' | 'pay') => live.reduce((n, r) => n + (r[k] ?? 0), 0);
  return {
    rows: rows.length,
    claim: sum('claim'),
    pay: sum('pay'),
    claimUnknown: live.filter((r) => r.claim === null).length,
    payUnknown: live.filter((r) => r.pay === null).length,
  };
}

/** 원 단위 표시. 모르면 빈칸(0 이 아니다). */
export function won(n: number | null): string {
  return n === null ? '' : n.toLocaleString('ko-KR');
}

/** 입력 칸 → 수. 빈칸은 null, 숫자가 아니면 NaN(저장 전에 막는다). */
export function parseWon(s: string): number | null {
  const v = s.replace(/[,\s원]/g, '');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
