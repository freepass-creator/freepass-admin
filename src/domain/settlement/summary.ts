import { adminBlockLabel, blockOf, intakeTaskOf, type SettlementRow } from './types';
import { billingMonth } from './stage';
import { NO_MONTH } from './ledgers';
import { invoiceMoneyOf } from './lifecycle';
import { isCalendarMonth } from './calendar';

export interface SupplierSummary {
  supplier: string | null;
  count: number;
  claim: number | null;
  claimUnknown: number;
  pay: number | null;
  payUnknown: number;
  margin: number | null;
}

export interface SettlementSummary {
  month: string;
  months: string[];
  suppliers: SupplierSummary[];
  total: SupplierSummary;
  amountConfirmed: number;
  needsAttention: number;
  reasons: { label: string; count: number }[];
}

const empty = (supplier: string | null): SupplierSummary => ({
  supplier, count: 0, claim: null, claimUnknown: 0, pay: null, payUnknown: 0, margin: null,
});
const addKnown = (sum: number | null, value: number | null) => value === null ? sum : (sum ?? 0) + value;
const supply = (value: number | null, vatIncluded: boolean) =>
  value === null || !Number.isFinite(value) ? null : invoiceMoneyOf(value, vatIncluded).net;

/** 접수의 저장 금액 투영. 요율/가감/분납 재계산이나 발행 가능 여부를 결정하지 않는다. */
export function settlementSummary(rows: readonly SettlementRow[], requestedMonth = '', now = new Date()): SettlementSummary {
  // 접수 목록과 같은 월 우선순위: 사람이 적은 월 → 도메인의 예정월.
  const entries = rows.filter(r => intakeTaskOf(r) !== '취소' && !r.contractCancelledAt && !r.progress.settleExclude)
    .map(row => {
      const month = row.progress.billMonth || billingMonth(row, now);
      return { row, month: month && isCalendarMonth(month) ? month : NO_MONTH };
    });
  const months = [...new Set(entries.map(x => x.month).filter(m => m !== NO_MONTH))].sort().reverse();
  if (entries.some(x => x.month === NO_MONTH)) months.push(NO_MONTH);
  const month = requestedMonth || months[0] || NO_MONTH;
  const bySupplier = new Map<string | null, SupplierSummary>();
  const reasons = new Map<string, number>();
  const total = empty(null);
  let amountConfirmed = 0;
  let needsAttention = 0;
  for (const { row: r, month: m } of entries) {
    if (m !== month) continue;
    const claim = supply(r.money.claim, r.money.vatIncluded);
    const pay = supply(r.money.pay, r.money.vatIncluded);
    const margin = claim === null || pay === null ? null : claim - pay;
    const group = bySupplier.get(r.supplier) ?? empty(r.supplier);
    bySupplier.set(r.supplier, group);
    for (const target of [group, total]) {
      target.count++;
      target.claim = addKnown(target.claim, claim);
      target.pay = addKnown(target.pay, pay);
      target.margin = addKnown(target.margin, margin);
      if (claim === null) target.claimUnknown++;
      if (pay === null) target.payUnknown++;
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
  };
}

export const SETTLEMENT_SUMMARY_HEADERS = [
  '공급사', '건수', '청구할 합계(확정분·공급가)', '청구 미확정 건수',
  '지급할 합계(확정분·공급가)', '지급 미확정 건수', '우리 몫(양쪽 확정분·공급가)',
] as const;

export function settlementSummaryCells(row: SupplierSummary, total = false): (string | number | null)[] {
  return [total ? '합계' : row.supplier ?? '(공급사 미정)', row.count, row.claim,
    row.claimUnknown, row.pay, row.payUnknown, row.margin];
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
