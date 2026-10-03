/**
 * **접수 데스크** — 직원이 접수하고, 접수 목록을 한눈에 보는 화면의 순수한 조각.
 *
 * ★사용자 결정 2026-10-03 「엑셀은 참고. 아주 심플하게, 엑셀보다 편하고 눈에 띄게. 접수만 하면 된다. ERP처럼」
 *   목록은 «보기», 오른쪽 판은 «처리» (Codex 상의 결과). 좌우 스크롤 없음.
 * ★저장소는 기존 settlement_rows 그대로. 상태 판정은 화면이 만들지 않고 도메인(intakeTaskOf·blockOf)을 그대로 쓴다.
 * ★모르는 금액(null)은 0 으로 더하지 않는다. 「미확정」 으로 따로 센다.
 */
import { adminBlockLabel, blockOf, intakeTaskOf, type IntakeTask, type SettlementRow } from '../../domain/settlement/types';
import { billingMonth } from '../../domain/settlement/stage';
import { intakeAgeDays } from '../../domain/settlement/intake-list';
import { ledgerKindOf } from '../../domain/settlement/product-kind';
import type { CanonicalProduct } from '../../domain/product/types';

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
  /** 사람이 찍은 청구월 */
  billMonth: string;
  /** 도메인이 셈한 청구월(찍힌 값이 없을 때의 예정). 모르면 '' */
  expectedMonth: string;
  claim: number | null;
  pay: number | null;
  cancelled: boolean;
  note: string;
  /** 업무 단계 — intakeTaskOf 그대로 */
  task: IntakeTask;
  /** 지금 막힌 것(사람용 문구) — blockOf → adminBlockLabel. 없으면 '' */
  block: string;
  /** 접수 후 지난 날 수(인도 전 건의 지연 신호). 모르면 null */
  ageDays: number | null;
}

const t = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function toLedgerRow(r: SettlementRow, today: string, now = new Date()): LedgerRow {
  const block = blockOf(r);
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
    expectedMonth: t(billingMonth(r, now)),
    claim: r.money.claim ?? null,
    pay: r.money.pay ?? null,
    cancelled: !!r.progress.cancelled,
    note: t(r.note),
    task: intakeTaskOf(r),
    block: block ? adminBlockLabel(block) : '',
    ageDays: intakeAgeDays(r, today),
  };
}

/* ── 탭 · 칩 ─────────────────────────────────────────────── */

/** 탭 — 업무 상태. 기본은 «처리 필요»(아직 인도 전, 손댈 건) */
export type LedgerTab = '처리 필요' | '정산 대기' | '완료' | '취소' | '전체';
export const LEDGER_TABS: LedgerTab[] = ['처리 필요', '정산 대기', '완료', '취소', '전체'];

export function inTab(r: LedgerRow, tab: LedgerTab): boolean {
  switch (tab) {
    case '처리 필요': return r.task === '계약' || r.task === '차량' || r.task === '인도';
    case '정산 대기': return r.task === '정산';
    case '완료': return r.task === '완료';
    case '취소': return r.task === '취소';
    default: return true;
  }
}

/** 눈에 띄게 할 «지금 손댈 것» 셋 — 누르면 그 건만 거른다 */
export type LedgerChip = '계약서 대기' | '인도 대기' | '금액 미확정';
export const LEDGER_CHIPS: LedgerChip[] = ['계약서 대기', '인도 대기', '금액 미확정'];

export function inChip(r: LedgerRow, chip: LedgerChip): boolean {
  if (r.cancelled) return false;
  if (chip === '계약서 대기') return r.task === '계약';
  if (chip === '인도 대기') return r.task === '인도' || r.task === '차량';
  return r.claim === null || r.pay === null;
}

export interface LedgerFilter {
  tab: LedgerTab;
  chip: LedgerChip | null;
  q: string;
  /** `YYYY-MM` 청구월(찍힌 값 또는 예정), `` = 전체 */
  month: string;
}

const SEARCH_KEYS = ['plate', 'customer', 'supplier', 'model', 'channel', 'agent', 'product', 'note'] as const;

export function monthOf(r: LedgerRow): string {
  return r.billMonth || r.expectedMonth;
}

export function filterLedger(rows: LedgerRow[], f: LedgerFilter): LedgerRow[] {
  const q = f.q.replace(/\s/g, '').toLowerCase();
  return rows.filter((r) => {
    if (f.chip ? !inChip(r, f.chip) : !inTab(r, f.tab)) return false;
    if (f.month && monthOf(r) !== f.month) return false;
    if (q && !SEARCH_KEYS.some((k) => r[k].replace(/\s/g, '').toLowerCase().includes(q))) return false;
    return true;
  });
}

/** 처리 필요는 오래된 접수가 위(늦어진 건이 먼저 보인다), 나머지는 최신이 위. sortIntakeRows 와 같은 규칙. */
export function sortLedger(rows: LedgerRow[], tab: LedgerTab, chip: LedgerChip | null = null): LedgerRow[] {
  const oldestFirst = chip ? chip !== '금액 미확정' : tab === '처리 필요';
  return [...rows].sort((a, b) => {
    const byDate = a.receivedAt.localeCompare(b.receivedAt);
    if (byDate !== 0) return oldestFirst ? byDate : -byDate;
    return a.code.localeCompare(b.code);
  });
}

export function countBy<K extends string>(rows: LedgerRow[], keys: K[], test: (r: LedgerRow, k: K) => boolean): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, rows.filter((r) => test(r, k)).length])) as Record<K, number>;
}

/** 청구월 목록 — 최신 달이 위 */
export function billMonthsOf(rows: LedgerRow[]): string[] {
  return [...new Set(rows.map(monthOf).filter(Boolean))].sort().reverse();
}

export interface LedgerTotals {
  rows: number;
  claim: number;
  pay: number;
  claimUnknown: number;
  payUnknown: number;
}

/** 합계 — 취소 줄은 금액에 넣지 않는다. */
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

/** 진행 단계 넷 — 목록의 체크라인. 지금 막힌 단계만 진하게 칠한다. */
export type StepState = 'done' | 'now' | 'todo';
export const STEPS = ['계약서', '차번', '인도', '정산'] as const;

export function stepsOf(r: LedgerRow): StepState[] {
  const order = { 계약: 0, 차량: 1, 인도: 2, 정산: 3, 완료: 4, 취소: -1 } as const;
  const at = order[r.task];
  return STEPS.map((_, i) => (at < 0 ? 'todo' : i < at ? 'done' : i === at ? 'now' : 'todo'));
}

/** 상태 색 — 빨강: 금액·필수 누락 / 노랑: 기다림 / 초록: 완료 / 회색: 취소 */
export type Tone = 'red' | 'yellow' | 'green' | 'gray';
export function toneOf(r: LedgerRow): Tone {
  if (r.task === '취소') return 'gray';
  if (r.task === '완료') return 'green';
  /* 빨강은 «사람이 넣어야 진행되는 누락» 만 — 공급사·영업채널·금액. 계약서·차번·인도 대기는 노랑. */
  if (/공급사|영업채널|금액/.test(r.block)) return 'red';
  return 'yellow';
}

/** 원 단위 표시. 모르면 빈칸(0 이 아니다). */
export function won(n: number | null): string {
  return n === null ? '' : n.toLocaleString('ko-KR');
}

/* ── 차량번호로 프리패스 상품 조건 찾기 (Codex codex/intake-ledger-lifecycle 의 plateChoices 를 옮김) ── */

/** 고를 수 있는 조건 한 묶음 = 상품 하나의 Offer 하나. 고르면 «상품 접수» 로 저장된다(snapshot 봉인). */
export interface PlateOffer {
  supplierBillingFee?: import('../../domain/product/types').TermEconomicAmount;
  channelPayoutFee?: import('../../domain/product/types').TermEconomicAmount;
  key: string;
  /** 이 조건이 붙은 차량번호(공백 없이) — 화면 차번이 바뀌면 이 조건은 못 쓴다 */
  plate: string;
  productId: string; offerId: string; version: number; snapshot: string;
  supplier: string; model: string; product: string; term: number | null; rent: number | null; deposit: number | null; price: number | null;
}

/**
 * 조회 가드 — 접수 원장은 봉인 저장까지 가는 업무라 «정본이 확인된» 상품 조건만 불러온다.
 * (총괄·Codex 결정 2026-10-03: FreePass Data ACTIVE + policyParity/commercialCoverage COMPLETE 가 아니면 보류. fail-closed)
 * 돌려주는 값: null = 불러와도 된다 / 글 = 보류 이유(화면에 그대로 보인다).
 */
export function catalogLookupHold(meta: { authority?: string; policyParity?: string; commercialCoverage?: string } | null | undefined): string | null {
  if (!meta) return '프리패스 상품 정본을 확인하지 못했습니다 — 조건을 불러오지 않습니다. 직접 입력해 주세요';
  if (meta.authority !== undefined && meta.authority !== 'CANONICAL_ACTIVE') return '프리패스 상품 정본(ACTIVE)이 아닙니다 — 조건을 불러오지 않습니다. 직접 입력해 주세요';
  if (meta.policyParity !== 'COMPLETE') return '프리패스 상품의 정책 검증이 끝나지 않았습니다 — 정본 확인 전이라 조건을 불러오지 않습니다. 직접 입력해 주세요';
  if (meta.commercialCoverage !== 'COMPLETE') return '프리패스 상품의 거래 조건 검증이 끝나지 않았습니다 — 정본 확인 전이라 조건을 불러오지 않습니다. 직접 입력해 주세요';
  return null;
}

/** 차량번호 비교 — 공백·하이픈 무시 */
export const plateKey = (s: string) => s.replace(/[\s-]/g, '').toUpperCase();

export function plateOffers(products: CanonicalProduct[], plate: string): PlateOffer[] {
  const target = plateKey(plate);
  if (!target) return [];
  return products
    .filter((p) => plateKey(p.registration?.vehicleNumber ?? '') === target)
    /* 원장 상품구분으로 못 옮기는 상품은 조건으로 내놓지 않는다 — 고르면 상품구분이 빈 채로 저장된다(Codex 검토) */
    .filter((p) => ledgerKindOf(p.productKind) !== null)
    .flatMap((p) => p.offers.map((o) => ({
      key: `${p.id}|${o.id}`,
      ...(o.supplierBillingFee !== undefined ? { supplierBillingFee: o.supplierBillingFee } : {}),
      ...(o.channelPayoutFee !== undefined ? { channelPayoutFee: o.channelPayoutFee } : {}),
      plate: target,
      productId: p.id, offerId: o.id, version: p.version, snapshot: p.sourceSnapshotId,
      supplier: o.supplierName ?? p.supplierName ?? '',
      /* 저장(createIntakeFrom)과 같은 모델 표기 */
      model: [p.vehicle.modelId, p.vehicle.subModelId].filter(Boolean).join(' '),
      product: ledgerKindOf(p.productKind)?.product ?? '',
      term: Number.isFinite(o.termMonths) ? o.termMonths : null,
      rent: Number.isFinite(o.monthlyRent) ? o.monthlyRent : null,
      deposit: o.deposit ?? null,
      price: p.consumerPrice ?? null,
    })));
}

/* ── 입력 공통 규격 — 화면이 저장 전에 같은 꼴로 맞춘다(서버도 같은 규칙으로 다시 읽는다) ── */

/** 금액 칸: 칸을 떠날 때 「1234567원」 → 「1,234,567」. 숫자가 아니면 그대로 둬서 저장 때 오류로 알린다. */
export function formatWonInput(s: string): string {
  const n = parseWon(s);
  return n === null || Number.isNaN(n) ? s.trim() : n.toLocaleString('ko-KR');
}

/** 개월 칸: 「36개월」 → 「36」 */
export function formatTermInput(s: string): string {
  const t = s.replace(/[\s개월,]/g, '');
  return /^\d+$/.test(t) ? String(Number(t)) : s.trim();
}

/** 차량번호: 공백 없이 — 원장 열쇠(settlementKey/intakeKey)와 같은 규칙 */
export const normPlate = (s: string) => s.replace(/\s/g, '');

/** 이름 칸: 앞뒤 공백 · 겹친 공백 정리 */
export const normName = (s: string) => s.trim().replace(/\s+/g, ' ');

/** 입력 칸 → 수. 빈칸은 null, 숫자가 아니면 NaN(저장 전에 막는다). */
export function parseWon(s: string): number | null {
  const v = s.replace(/[,\s원]/g, '');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
