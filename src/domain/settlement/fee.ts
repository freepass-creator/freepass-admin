import type { TermEconomicAmount } from '../product/types';

/** 내부 수수료 조회 v1. 저장값만 읽으며 calculation은 실행하지 않는다. */
export type DataFee = {
  ruleId: string | null; policyId: string | null; sourceRefs: string[];
} & (
  | { status: 'CONFIRMED'; state: 'KNOWN' | 'ZERO'; amount: number; reasonCode: null }
  | { status: 'CONFIRMED'; state: 'NOT_APPLICABLE'; amount: null; reasonCode: null }
  | { status: 'UNCONFIRMED'; state: 'UNKNOWN'; amount: null; reasonCode: string }
);

export function readDataFee(fee: TermEconomicAmount | undefined): DataFee {
  const provenance = { ruleId: fee?.ruleId ?? null, policyId: fee?.policyId ?? null, sourceRefs: [...(fee?.sourceRefs ?? [])] };
  if (fee?.state === 'NOT_APPLICABLE') return { ...provenance, status: 'CONFIRMED', state: 'NOT_APPLICABLE', amount: null, reasonCode: null };
  if (fee?.state === 'ZERO') return { ...provenance, status: 'CONFIRMED', state: 'ZERO', amount: 0, reasonCode: null };
  if (fee?.state === 'KNOWN' && fee.amount?.currency === 'KRW' && typeof fee.amount.amount === 'number' && Number.isFinite(fee.amount.amount) && fee.amount.amount >= 0) {
    return { ...provenance, status: 'CONFIRMED', state: 'KNOWN', amount: fee.amount.amount, reasonCode: null };
  }
  return { ...provenance, status: 'UNCONFIRMED', state: 'UNKNOWN', amount: null, reasonCode: fee?.reasonCode?.trim() ? fee.reasonCode : 'REASON_NOT_RECORDED' };
}

export function dataFeeAmount(fee: TermEconomicAmount | undefined): number | null {
  return readDataFee(fee).amount;
}

export function dataFeeLabel(fee: TermEconomicAmount | DataFee | undefined): string {
  const value = fee && 'status' in fee ? fee : readDataFee(fee);
  return value.state === 'NOT_APPLICABLE' ? '해당 없음' : value.status === 'UNCONFIRMED'
    ? `미확정 · ${value.reasonCode}` : `${value.amount.toLocaleString('ko-KR')}원`;
}

/** 과거 접수 표시: 기재 금액만 읽고 현재 요율로 과거 산식을 재구성하지 않는다. */
export function receiptRowBasis(row: Record<string, unknown>): { claim: string; pay: string } {
  const label = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    ? `기재액 ${value.toLocaleString('ko-KR')}원 · 산식근거 미기록` : '미확정';
  return { claim: label(row.sourceReceiptClaim), pay: label(row.sourceReceiptPay) };
}

// GA 표의 비계산 설명 메타데이터에 사용하는 타입과 이름 정규화.
export type FeeBasis = '차량가액' | '대여료×기간' | '정액' | '한달렌탈료' | '구독료+정액' | '범위' | '조건분기';
export type FeeKind = '신차' | '재렌트' | '구독' | '전기차';

export interface FeeRule {
  id: string;
  supplier: string;
  kind: FeeKind;
  form: string;        // 선출고 · 선발주 · 발주 · 매칭출고 · 인수형 · 인수,반납형 · ''
  term: number;        // 0 = 기간 무관
  basis: FeeBasis;
  claim: number | string;   // GA 표 설명 메타데이터. 이 타입으로 금액을 계산하지 않는다
  pay: number | string;
  when: string;
  auto: boolean;
  note?: string;
}

export const headOf = (s: string) => s.replace(/\s|주식회사|㈜|렌터카|렌트카|모빌리티|\(.*\)/g, '');
