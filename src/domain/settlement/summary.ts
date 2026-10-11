import { adminBlockLabel, blockOf, intakeTaskOf, type SettlementRow } from './types';
import { billingMonth } from './stage';
import { NO_MONTH } from './ledgers';
import { invoiceMoneyOf } from './lifecycle';
import { isCalendarMonth } from './calendar';
import { truncWon } from './money';
import { terminationClawbackReview } from './clawback';
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
  FEE_APPROX: '가격행 수수료 근사',
};
export interface FeeLinkCounts {
  linked: number; needsAttention: number; matched: number; different: number; approx: number;
  unavailableCode?: string;
}
const emptyFeeLinks = (): FeeLinkCounts => ({ linked: 0, needsAttention: 0, matched: 0, different: 0, approx: 0 });
export function feeLinkText(counts: FeeLinkCounts | null): string {
  if (!counts) return '가격행 검증 미실행';
  if (counts.unavailableCode) return `가격행 검증 불가 · ${counts.unavailableCode}`;
  return `이어 붙음 ${counts.linked} · 확인 필요 ${counts.needsAttention} · 일치 ${counts.matched} · 차이 ${counts.different} · 근사 ${counts.approx}`;
}
function feeValue(fee: ContractFeeValue | undefined) {
  const knownStatus = fee?.status === 'CONFIRMED' || fee?.status === 'UNCONFIRMED';
  const approx = knownStatus && fee?.state === 'CALCULATED_APPROX';
  const confirmed = fee?.status === 'CONFIRMED' && (fee.state === 'KNOWN' || fee.state === 'ZERO');
  const amount = (approx || confirmed) && fee?.amount && Number.isFinite(fee.amount.amount)
    && (fee.state !== 'ZERO' || fee.amount.amount === 0) ? truncWon(fee.amount.amount) : null;
  const unknown = !!fee && (!knownStatus
    || !['KNOWN', 'ZERO', 'UNKNOWN', 'NOT_APPLICABLE', 'CALCULATED_APPROX'].includes(fee.state));
  return { approx, amount, unknown };
}

function feeLinkOf(row: SettlementRow, read: ContractFeeLinksRead) {
  const counts = emptyFeeLinks();
  const fees = { claim: feeValue(undefined), pay: feeValue(undefined) };
  const reasons: ContractFeeLinkReason[] = [];
  if (read.status === 'UNAVAILABLE') return { counts: { ...counts, unavailableCode: read.code }, reasons, fees };
  const pending = new Set<ContractFeeLinkReason>(read.excluded.get(row.id));
  const result = read.results.get(row.id);
  if (pending.size === 0 && !result)
    return { counts: { ...counts, unavailableCode: 'INVALID_RESPONSE' }, reasons, fees };
  if (pending.size === 0 && result) {
    if (result.status === 'FAILED') pending.add(result.failure!);
    else {
      fees.claim = feeValue(result.fees?.supplierBillingFee);
      fees.pay = feeValue(result.fees?.channelPayoutFee);
      counts.linked = result.status === 'LINKED' ? 1 : 0;
      counts.approx = fees.claim.approx || fees.pay.approx ? 1 : 0;
      if (counts.approx) pending.add('FEE_APPROX');
      if (result.status !== 'LINKED') pending.add('FEE_UNCONFIRMED');
      const expected = [fees.claim, fees.pay].map(fee =>
        result.status === 'LINKED' || fee.approx ? fee.amount : null);
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
  return { counts, reasons: [...pending], fees };
}

export interface SupplierSummary {
  supplier: string | null;
  count: number;
  claim: number | null;
  claimUnknown: number;
  pay: number | null;
  payUnknown: number;
  margin: number | null;
  claimApprox: number | null;
  claimApproxCount: number;
  payApprox: number | null;
  payApproxCount: number;
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
  carryover: CarryoverSummary;
  asOf: { earliest: string | null; latest: string | null; missing: number };
}

type CarryoverMoney = { claim: number | null; pay: number | null };
export interface CarryoverItem {
  id: string;
  supplier: string | null;
  caseLabel: string;
  original: CarryoverMoney;
  corrected: CarryoverMoney;
  difference: CarryoverMoney;
  reason: string;
  evidence: string;
  status: '후보' | '확정';
}
export interface CarryoverTotal extends CarryoverMoney {
  count: number;
  claimUnknown: number;
  payUnknown: number;
}
export interface CarryoverSummary {
  month: string | null;
  items: CarryoverItem[];
  confirmed: CarryoverTotal;
  candidate: CarryoverTotal;
}

const empty = (supplier: string | null): SupplierSummary => ({
  supplier, count: 0, claim: null, claimUnknown: 0, pay: null, payUnknown: 0, margin: null, feeLinks: null,
  claimApprox: null, claimApproxCount: 0, payApprox: null, payApproxCount: 0,
});
const addKnown = (sum: number | null, value: number | null) => value === null ? sum : (sum ?? 0) + value;
const supply = (value: number | null, vatIncluded: boolean) =>
  value === null || !Number.isFinite(value) ? null : invoiceMoneyOf(value, vatIncluded).net;

/** 전월 저장액과 가감만 비교한다. 요율·프로모션·분납·환수 금액은 새로 계산하지 않는다. */
function carryoverOf(rows: readonly SettlementRow[], month: string) {
  const previous = isCalendarMonth(month) && month === month.trim()
    ? new Date(`${month}-01T00:00:00Z`) : null;
  previous?.setUTCMonth(previous.getUTCMonth() - 1);
  const previousMonthValue = previous?.toISOString().slice(0, 7);
  const previousMonth = previousMonthValue && isCalendarMonth(previousMonthValue) ? previousMonthValue : null;
  const total = (): CarryoverTotal => ({ count: 0, claim: null, pay: null, claimUnknown: 0, payUnknown: 0 });
  const result: CarryoverSummary = { month: previousMonth, items: [], confirmed: total(), candidate: total() };
  const sourceRows: SettlementRow[] = [];
  for (const row of rows) {
    // 전월을 추정하지 않는다. 취소·제외된 줄도 가감/정정 사실 자체를 숨기지 않는다.
    if (!previousMonth || row.progress.billMonth !== previousMonth) continue;
    const original = { claim: supply(row.money.claim, row.money.vatIncluded), pay: supply(row.money.pay, row.money.vatIncluded) };
    const adjusted = [row.money.claimAdjust, row.money.payAdjust].some(v => v !== null && Number.isFinite(v) && v !== 0);
    const unknown = original.claim === null || original.pay === null;
    const correction = row.claimStage === '정정' || row.payStage === '정정';
    const review = terminationClawbackReview(row, []);
    const clawback = !['NONE', 'NOT_REQUIRED'].includes(review);
    if (!adjusted && !unknown && !correction && !clawback) continue;
    const corrected: CarryoverMoney = { claim: null, pay: null };
    const difference: CarryoverMoney = { claim: null, pay: null };
    for (const axis of ['claim', 'pay'] as const) {
      const amount = row.money[axis];
      const adjustment = row.money[axis === 'claim' ? 'claimAdjust' : 'payAdjust'] ?? 0;
      if (adjusted && original[axis] !== null && amount !== null && Number.isFinite(adjustment)) {
        corrected[axis] = supply(truncWon(amount) + truncWon(adjustment), row.money.vatIncluded);
        // 한쪽이라도 미확정이면 해당 건의 차액은 모름으로 유지한다.
        if (!unknown && corrected[axis] !== null) difference[axis] = truncWon(corrected[axis]! - original[axis]!);
      }
    }
    const evidence = adjusted ? row.money.adjustReason?.trim() || null : null;
    const reasons = [
      adjusted ? '청구·지급 가감' : null,
      original.claim === null ? '청구액 미확정' : null,
      original.pay === null ? '지급액 미확정' : null,
      correction ? '정정 상태' : null,
      clawback ? '환수 검토' : null,
      row.progress.cancelled || row.contractCancelledAt ? '취소된 건' : null,
      row.progress.settleExclude ? '정산 제외된 건' : null,
    ].filter(Boolean);
    const status = adjusted && evidence && !unknown && !correction && !clawback
      && !row.progress.cancelled && !row.contractCancelledAt && !row.progress.settleExclude
      && difference.claim !== null && difference.pay !== null ? '확정' : '후보';
    result.items.push({ id: row.id, supplier: row.supplier,
      caseLabel: [row.plate || row.id, row.receivedAt].filter(Boolean).join(' · '),
      original, corrected, difference, reason: reasons.join(' · '), evidence: evidence ?? '근거 없음', status });
    sourceRows.push(row);
    const sum = status === '확정' ? result.confirmed : result.candidate;
    sum.count++;
    for (const axis of ['claim', 'pay'] as const) {
      sum[axis] = addKnown(sum[axis], difference[axis]);
      if (difference[axis] === null) sum[axis === 'claim' ? 'claimUnknown' : 'payUnknown']++;
    }
  }
  return { result, sourceRows };
}

/** 화면과 CSV의 모든 숫자가 같은 원본 갱신 시각 범위를 참조한다. */
export function settlementAsOfText(asOf: SettlementSummary['asOf']): string {
  if (!asOf.earliest || !asOf.latest) return '기준 시각 알 수 없음';
  const format = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  return `기준 시각 ${format(asOf.earliest)} ~ ${format(asOf.latest)} (한국 시각 · 원본 갱신 시각)`
    + (asOf.missing ? ` · 기준 시각 알 수 없음 ${asOf.missing}건` : '');
}

export function carryoverTitle(carryover: CarryoverSummary): string {
  return carryover.month ? `전월(${Number(carryover.month.slice(5))}월) 가감` : '전월 가감 · 청구월 미정';
}

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

/** 접수 저장액·수신한 근사·전월 가감 비교의 분리 투영. 요율/분납을 재계산하거나 발행 가능 여부를 결정하지 않는다. */
export function settlementSummary(rows: readonly SettlementRow[], requestedMonth = '', now = new Date(), feeLinks?: ContractFeeLinksRead): SettlementSummary {
  const entries = summaryEntries(rows, now);
  const months = [...new Set(entries.map(x => x.month).filter(m => m !== NO_MONTH))].sort().reverse();
  if (entries.some(x => x.month === NO_MONTH)) months.push(NO_MONTH);
  const month = requestedMonth || months[0] || NO_MONTH;
  const carryover = carryoverOf(rows, month);
  const basisRows = [...new Set([...entries.filter(x => x.month === month).map(x => x.row), ...carryover.sourceRows])];
  const timestamps = basisRows.map(r => r.updatedAt ? Date.parse(r.updatedAt) : NaN).filter(Number.isFinite).sort((a, b) => a - b);
  const asOf = { earliest: timestamps.length ? new Date(timestamps[0]).toISOString() : null,
    latest: timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
    missing: basisRows.length - timestamps.length };
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
    const verification = feeLinks ? feeLinkOf(r, feeLinks) : null;
    const claimApprox = verification?.fees.claim.approx ?? false;
    const payApprox = verification?.fees.pay.approx ?? false;
    // 저장액은 수정하지 않는다. 근사로 판정된 쪽은 확정분·우리 몫에서만 제외한다.
    const claim = claimApprox || verification?.fees.claim.unknown ? null : supply(r.money.claim, r.money.vatIncluded);
    const pay = payApprox || verification?.fees.pay.unknown ? null : supply(r.money.pay, r.money.vatIncluded);
    const margin = claim === null || pay === null ? null : claim - pay;
    const group = bySupplier.get(r.supplier) ?? empty(r.supplier);
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
      if (claimApprox) {
        target.claimApproxCount++;
        target.claimApprox = addKnown(target.claimApprox, verification!.fees.claim.amount);
      } else if (claim === null) target.claimUnknown++;
      if (payApprox) {
        target.payApproxCount++;
        target.payApprox = addKnown(target.payApprox, verification!.fees.pay.amount);
      } else if (pay === null) target.payUnknown++;
      if (verification) {
        target.feeLinks ??= emptyFeeLinks();
        for (const key of ['linked', 'needsAttention', 'matched', 'different', 'approx'] as const)
          target.feeLinks[key] += verification.counts[key];
        if (verification.counts.unavailableCode) target.feeLinks.unavailableCode = verification.counts.unavailableCode;
      }
    }
    if (margin !== null) amountConfirmed++;

    // 기존 도메인의 다음 막힘과 저장 사실만 센다. 이유는 한 접수에 여러 개일 수 있다.
    const pending = new Set<string>();
    if (claimApprox || payApprox) pending.add(CONTRACT_FEE_REASON_LABELS.FEE_APPROX);
    if (claim === null && !claimApprox) pending.add(adminBlockLabel('청구금액 모름'));
    if (pay === null && !payApprox) pending.add(adminBlockLabel('지급금액 모름'));
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
    carryover: carryover.result, asOf,
    suppliers: [...bySupplier.values()].sort((a, b) => (a.supplier ?? '').localeCompare(b.supplier ?? '', 'ko')),
    reasons: [...reasons].sort(([a], [b]) => a.localeCompare(b, 'ko')).map(([label, count]) => ({ label, count })),
    feeLinkReasons: [...feeLinkReasons].sort(([a], [b]) => a.localeCompare(b, 'ko')).map(([label, count]) => ({ label, count })),
  };
}

export const SETTLEMENT_SUMMARY_HEADERS = [
  '공급사', '건수', '청구할 합계(확정분·공급가)', '청구 미확정 건수',
  '지급할 합계(확정분·공급가)', '지급 미확정 건수', '우리 몫(양쪽 확정분·공급가)',
  '가격행 검증',
  '청구할 근사 합계(공급가)', '청구할 근사 건수', '지급할 근사 합계(공급가)', '지급할 근사 건수',
] as const;

export function settlementSummaryCells(row: SupplierSummary, total = false): (string | number | null)[] {
  return [total ? '합계' : row.supplier ?? '(공급사 미정)', row.count, row.claim,
    row.claimUnknown, row.pay, row.payUnknown, row.margin, feeLinkText(row.feeLinks),
    row.claimApprox, row.claimApproxCount, row.payApprox, row.payApproxCount];
}

export const CARRYOVER_HEADERS = ['공급사', '건 식별', '원래 청구액', '바로잡은 청구액', '청구 차액',
  '원래 지급액', '바로잡은 지급액', '지급 차액', '사유', '근거', '상태'] as const;

export function carryoverCells(item: CarryoverItem): (string | number | null)[] {
  return [item.supplier ?? '(공급사 미정)', item.caseLabel, item.original.claim, item.corrected.claim, item.difference.claim,
    item.original.pay, item.corrected.pay, item.difference.pay, item.reason, item.evidence, item.status];
}

export const CARRYOVER_TOTAL_HEADERS = ['상태', '건수', '청구 차액 합계', '청구 차액 모름', '지급 차액 합계', '지급 차액 모름'] as const;
export function carryoverTotalCells(carryover: CarryoverSummary): (string | number | null)[][] {
  return ([['확정', carryover.confirmed], ['후보', carryover.candidate]] as const)
    .map(([status, total]) => [status, total.count, total.claim, total.claimUnknown, total.pay, total.payUnknown]);
}

/** 내부 집계와 전월 가감만 출력. 알 수 없는 금액은 빈 셀이며 숫자 0과 구분한다. */
export function settlementSummaryCsv(summary: SettlementSummary): string {
  const cell = (value: string | number | null): string => {
    if (value === null) return '';
    if (typeof value === 'number') return String(value);
    // 문자열의 스프레드시트 수식 실행 방지. 음수 금액은 숫자로 그대로 출력한다.
    const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [
    [settlementAsOfText(summary.asOf)],
    [...SETTLEMENT_SUMMARY_HEADERS],
    ...summary.suppliers.map(r => settlementSummaryCells(r)),
    settlementSummaryCells(summary.total, true),
    [],
    [carryoverTitle(summary.carryover), summary.carryover.month, '부가세 별도 공급가 · 원', settlementAsOfText(summary.asOf)],
    [...CARRYOVER_HEADERS],
    ...summary.carryover.items.map(carryoverCells),
    [...CARRYOVER_TOTAL_HEADERS],
    ...carryoverTotalCells(summary.carryover),
  ].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
