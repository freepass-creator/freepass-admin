import { adminBlockLabel, blockOf, intakeTaskOf, type SettlementRow } from './types';
import { billingMonth } from './stage';
import { NO_MONTH } from './ledgers';
import { invoiceMoneyOf } from './lifecycle';
import { isCalendarMonth } from './calendar';
import { truncWon } from './money';
import type { ContractFeeLinkReason, ContractFeeLinksRead, ContractFeeValue } from '../../ports/admin-catalog-reader';

export const CONTRACT_FEE_REASON_LABELS: Record<ContractFeeLinkReason, string> = {
  NO_PLATE: '차량번호 없음', NO_ASSET: '새 카탈로그에 차 없음', MULTI_ASSET: '차량이 여러 건임',
  NO_PRODUCT: '연결된 상품 없음', MULTI_PRODUCT: '상품이 여러 건임', NO_OFFER: '연결된 제안 없음',
  MULTI_OFFER: '제안이 여러 건임', SUPPLIER_MISMATCH: '공급사가 다름', NO_TERM: '계약 기간에 맞는 가격행 없음',
  CONDITION_MISMATCH: '계약 조건이 가격행과 다름', MULTI_TERM: '가격행이 여러 건임',
  NO_SUPPLIER_CODE: '공급사 코드 없음', INVALID_SUPPLIER_CODE: '공급사 코드 형식 오류',
  INVALID_KEY: '접수 코드 없음·중복·형식 오류', INVALID_TERM: '계약 기간 없음·유효하지 않음',
  INVALID_CONDITION: '계약 금액 없음·유효하지 않음',
  FEE_UNCONFIRMED: '가격행 수수료 미확정', RECORDED_FEE_UNCONFIRMED: '접수 수수료 미확정',
  FEE_DIFFERENCE: '가격행 수수료와 접수 금액 차이',
};
export interface FeeLinkCounts {
  linked: number; needsAttention: number; matched: number; different: number;
  unavailableCode?: string;
}
const emptyFeeLinks = (): FeeLinkCounts => ({ linked: 0, needsAttention: 0, matched: 0, different: 0 });
export function feeLinkText(counts: FeeLinkCounts | null): string {
  if (!counts) return '가격행 검증 미실행';
  if (counts.unavailableCode) return `가격행 검증 불가 · ${counts.unavailableCode}`;
  return `이어 붙음 ${counts.linked} · 확인 필요 ${counts.needsAttention} · 일치 ${counts.matched} · 차이 ${counts.different}`;
}
const confirmedFee = (fee: ContractFeeValue | undefined): number | null =>
  fee?.status === 'CONFIRMED' && fee.amount !== null && Number.isFinite(fee.amount.amount)
    ? truncWon(fee.amount.amount) : null;

function feeLinkOf(row: SettlementRow, read: ContractFeeLinksRead): { counts: FeeLinkCounts; reasons: ContractFeeLinkReason[] } {
  const counts = emptyFeeLinks();
  if (read.status === 'UNAVAILABLE') return { counts: { ...counts, unavailableCode: read.code }, reasons: [] };
  const pending = new Set<ContractFeeLinkReason>(read.excluded.get(row.id));
  const result = read.results.get(row.id);
  if (pending.size === 0 && !result)
    return { counts: { ...counts, unavailableCode: 'INVALID_RESPONSE' }, reasons: [] };
  if (pending.size === 0 && result) {
    if (result.status === 'FAILED') pending.add(result.failure!);
    else if (result.status === 'FEE_UNCONFIRMED') pending.add('FEE_UNCONFIRMED');
    else {
      counts.linked = 1;
      const expected = [confirmedFee(result.fees?.supplierBillingFee), confirmedFee(result.fees?.channelPayoutFee)];
      const recorded = [supply(row.money.claim, row.money.vatIncluded), supply(row.money.pay, row.money.vatIncluded)];
      if (expected.some(v => v === null)) pending.add('FEE_UNCONFIRMED');
      if (recorded.some(v => v === null)) pending.add('RECORDED_FEE_UNCONFIRMED');
      if (expected.some((v, i) => v !== null && recorded[i] !== null && v !== recorded[i])) {
        counts.different = 1;
        pending.add('FEE_DIFFERENCE');
      } else if (pending.size === 0) counts.matched = 1;
    }
  }
  counts.needsAttention = pending.size ? 1 : 0;
  return { counts, reasons: [...pending] };
}

export interface SupplierSummary {
  supplier: string | null;
  count: number;
  claim: number | null;
  claimUnknown: number;
  pay: number | null;
  payUnknown: number;
  margin: number | null;
  feeLinks: FeeLinkCounts | null;
}

export interface SettlementSummary {
  month: string;
  months: string[];
  suppliers: SupplierSummary[];
  total: SupplierSummary;
  amountConfirmed: number;
  needsAttention: number;
  reasons: { label: string; count: number }[];
  feeLinkReasons: { label: string; count: number }[];
}

const empty = (supplier: string | null): SupplierSummary => ({
  supplier, count: 0, claim: null, claimUnknown: 0, pay: null, payUnknown: 0, margin: null, feeLinks: null,
});
const addKnown = (sum: number | null, value: number | null) => value === null ? sum : (sum ?? 0) + value;
const supply = (value: number | null, vatIncluded: boolean) =>
  value === null || !Number.isFinite(value) ? null : invoiceMoneyOf(value, vatIncluded).net;

function summaryEntries(rows: readonly SettlementRow[], now: Date) {
  // 접수 목록과 같은 월 우선순위: 사람이 적은 월 → 도메인의 예정월.
  return rows.filter(r => intakeTaskOf(r) !== '취소' && !r.contractCancelledAt && !r.progress.settleExclude)
    .map(row => {
      const month = row.progress.billMonth || billingMonth(row, now);
      return { row, month: month && isCalendarMonth(month) ? month : NO_MONTH };
    });
}

/** API 요청 대상과 집계 대상은 같은 월·제외 규칙을 사용한다. */
export function settlementSummaryRows(rows: readonly SettlementRow[], month: string, now = new Date()): SettlementRow[] {
  return summaryEntries(rows, now).filter(entry => entry.month === month).map(entry => entry.row);
}

/** 접수의 저장 금액 투영. 요율/가감/분납 재계산이나 발행 가능 여부를 결정하지 않는다. */
export function settlementSummary(rows: readonly SettlementRow[], requestedMonth = '', now = new Date(), feeLinks?: ContractFeeLinksRead): SettlementSummary {
  const entries = summaryEntries(rows, now);
  const months = [...new Set(entries.map(x => x.month).filter(m => m !== NO_MONTH))].sort().reverse();
  if (entries.some(x => x.month === NO_MONTH)) months.push(NO_MONTH);
  const month = requestedMonth || months[0] || NO_MONTH;
  const bySupplier = new Map<string | null, SupplierSummary>();
  const reasons = new Map<string, number>();
  const feeLinkReasons = new Map<string, number>();
  const total = empty(null);
  if (feeLinks) total.feeLinks = feeLinks.status === 'UNAVAILABLE'
    ? { ...emptyFeeLinks(), unavailableCode: feeLinks.code } : emptyFeeLinks();
  let amountConfirmed = 0;
  let needsAttention = 0;
  for (const { row: r, month: m } of entries) {
    if (m !== month) continue;
    const claim = supply(r.money.claim, r.money.vatIncluded);
    const pay = supply(r.money.pay, r.money.vatIncluded);
    const margin = claim === null || pay === null ? null : claim - pay;
    const group = bySupplier.get(r.supplier) ?? empty(r.supplier);
    const verification = feeLinks ? feeLinkOf(r, feeLinks) : null;
    if (verification) for (const reason of verification.reasons) {
      const label = CONTRACT_FEE_REASON_LABELS[reason];
      feeLinkReasons.set(label, (feeLinkReasons.get(label) ?? 0) + 1);
    }
    bySupplier.set(r.supplier, group);
    for (const target of [group, total]) {
      target.count++;
      target.claim = addKnown(target.claim, claim);
      target.pay = addKnown(target.pay, pay);
      target.margin = addKnown(target.margin, margin);
      if (claim === null) target.claimUnknown++;
      if (pay === null) target.payUnknown++;
      if (verification) {
        target.feeLinks ??= emptyFeeLinks();
        for (const key of ['linked', 'needsAttention', 'matched', 'different'] as const)
          target.feeLinks[key] += verification.counts[key];
        if (verification.counts.unavailableCode) target.feeLinks.unavailableCode = verification.counts.unavailableCode;
      }
    }
    if (margin !== null) amountConfirmed++;

    // 기존 도메인의 다음 막힘과 저장 사실만 센다. 이유는 한 접수에 여러 개일 수 있다.
    const pending = new Set<string>();
    if (claim === null) pending.add(adminBlockLabel('청구금액 모름'));
    if (pay === null) pending.add(adminBlockLabel('지급금액 모름'));
    const task = intakeTaskOf(r);
    const block = blockOf(r);
    if (block && (task === '계약' || task === '차량' || task === '인도'
      || block === '공급사 없음' || block === '영업채널 없음')) pending.add(adminBlockLabel(block));
    if (!r.progress.delivered) pending.add(adminBlockLabel('인도'));
    if (m === NO_MONTH) pending.add(NO_MONTH);
    if (r.progress.billHold) pending.add('보류');
    if (pending.size) needsAttention++;
    for (const label of pending) reasons.set(label, (reasons.get(label) ?? 0) + 1);
  }
  return {
    month, months, total, amountConfirmed, needsAttention,
    suppliers: [...bySupplier.values()].sort((a, b) => (a.supplier ?? '').localeCompare(b.supplier ?? '', 'ko')),
    reasons: [...reasons].sort(([a], [b]) => a.localeCompare(b, 'ko')).map(([label, count]) => ({ label, count })),
    feeLinkReasons: [...feeLinkReasons].sort(([a], [b]) => a.localeCompare(b, 'ko')).map(([label, count]) => ({ label, count })),
  };
}

export const SETTLEMENT_SUMMARY_HEADERS = [
  '공급사', '건수', '청구할 합계(확정분·공급가)', '청구 미확정 건수',
  '지급할 합계(확정분·공급가)', '지급 미확정 건수', '우리 몫(양쪽 확정분·공급가)',
  '가격행 검증',
] as const;

export function settlementSummaryCells(row: SupplierSummary, total = false): (string | number | null)[] {
  return [total ? '합계' : row.supplier ?? '(공급사 미정)', row.count, row.claim,
    row.claimUnknown, row.pay, row.payUnknown, row.margin, feeLinkText(row.feeLinks)];
}

/** 내부 공급사 집계만 출력. 알 수 없는 합계는 빈 셀이며 숫자 0과 구분한다. */
export function settlementSummaryCsv(summary: SettlementSummary): string {
  const cell = (value: string | number | null): string => {
    if (value === null) return '';
    if (typeof value === 'number') return String(value);
    // 문자열의 스프레드시트 수식 실행 방지. 음수 금액은 숫자로 그대로 출력한다.
    const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [
    [...SETTLEMENT_SUMMARY_HEADERS],
    ...summary.suppliers.map(r => settlementSummaryCells(r)),
    settlementSummaryCells(summary.total, true),
  ].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
