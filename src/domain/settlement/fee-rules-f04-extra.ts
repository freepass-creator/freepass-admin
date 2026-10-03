/**
 * **F04 「수수료표」 탭에만 있는 규칙 — erp4 표에 없는 줄.**
 *
 * ★2026-10-03 대표 「정산 시트에 수수료 탭은 기본적으로 있다」 → 청구·지급 규칙의 정본은 F04 「수수료표」 탭이다.
 *   erp4 `settlement-fee-table.ts` 150규칙은 탭 A2:J159 와 같다(10-03 대조). 그 뒤 탭에 «추가된» 줄 중
 *   ERP5 수수료 규칙(settlement_fee_rules)에 넣는 것만 여기 둔다. `scripts/fee-rules-to-erp5.mts` 가 erp4 규칙 뒤에 붙여 쓴다.
 *
 * ★금액 기준이 정해지지 않은 줄은 `auto: false` — 기계가 금액을 내지 않고 접수 때 사람이 넣는다(0 으로 세지 않는다).
 */
import { headOf, type FeeRule } from './fee';

export const F04_EXTRA_RULES: Omit<FeeRule, 'id'>[] = [
  {
    /*
     * F04 수수료표 169·170행 — 확정(김건식 대표 10-03 메일 첨부 「□ 중고차 구독 서비스 잔가율.xlsx」 잔가표 시트 74~80행
     * «영업 GA 지급 수수료율» · 대표 10-03 결정 장부 27줄).
     * ★값은 확정이지만 auto=false 로 둔다 — 정액이 «보증금 선납/분납 × 기간» 으로 갈리고 «추가보증금 ×10%(최대 40만)» 가 붙는데,
     *   접수에는 추가보증금 칸이 없고 feeOf 는 선납/분납을 받지 않는다. 자동으로 세면 가산이 빠져 조용히 적게 나온다.
     *   접수 때 사람이 아래 표대로 넣는다(넣은 값이 이긴다).
     */
    supplier: '뮤카', kind: '구독', form: '', term: 0, basis: '조건분기',
    claim: '차량 기준가×1% (프리패스 몫 · 전 기간 · 별도 지급)',
    pay: '영업 GA 정액 — 보증금 선납: 12개월 100만 / 24·36·48개월 120만 · 분납: 12개월 80만 / 24·36·48개월 100만 + 추가보증금×10%(최대 40만)',
    when: '보증금 분납 완납 전 미지급', auto: false,
    note: '확정 — F04 수수료표 169·170행 · 김건식 대표 10-03 잔가율.xlsx 잔가표 74~80행. 프리패스 1%와 GA 정액을 별도로 둘 다 지급(서로 빼지 않음) · 지급 기준금액 VAT 포함 또는 3.3% 원천세 포함 · 차급 구분 없음',
  },
];

/** 원장·메일에 「무카」로도 적힌다(2026-10-01 「무카 김건식」 메일) */
export const F04_EXTRA_ALIASES: Record<string, string> = { 무카: '뮤카' };

export function isMewcar(supplier: string | null | undefined): boolean {
  const name = headOf(supplier ?? '');
  return (F04_EXTRA_ALIASES[name] ?? name) === '뮤카';
}

type UnknownPayout = { status: 'UNKNOWN'; why: string };

/** 지급 기준금액(VAT/원천세 포함). 지급 가능 여부, 프리패스 몫은 계산하지 않는다.
 * 분납은 완납 전 미지급이며, 이 비교용 계산이 auto:false를 대체하지 않는다.
 */
export function mewcarGaPayout({ prepaid, term, extraDeposit }: {
  prepaid: boolean; term: number; extraDeposit: number;
}): number | UnknownPayout {
  if (typeof prepaid !== 'boolean') return { status: 'UNKNOWN', why: '보증금 선납/분납 미확인' };
  if (![12, 24, 36, 48].includes(term)) return { status: 'UNKNOWN', why: '계약기간은 12·24·36·48개월만 계산 가능' };
  if (!Number.isSafeInteger(extraDeposit) || extraDeposit < 0) {
    return { status: 'UNKNOWN', why: '추가보증금은 0 이상의 안전한 정수 금액이어야 합니다' };
  }
  /* 10% 가산에 원 미만이 생기면 모른다 — 원 단위 처리 규정이 아직 없다(F04 수수료표 「원 단위 처리」 미확정) */
  if (extraDeposit % 10 !== 0) return { status: 'UNKNOWN', why: '추가보증금 10%에 원 미만이 생김 — 원 단위 처리 미확정' };
  const base = prepaid ? (term === 12 ? 1_000_000 : 1_200_000) : (term === 12 ? 800_000 : 1_000_000);
  return base + Math.min(extraDeposit / 10, 400_000);
}

export type MewcarBasis =
  | { status: 'KNOWN'; prepaid: boolean; extraDeposit: number }
  | { status: 'UNKNOWN'; reasons: string[] };

/** 명시된 근거만 읽는다. 누락·모순·깨진 숫자는 0원이나 선납으로 추정하지 않는다. */
export function mewcarBasisFromNote(note: string | null | undefined): MewcarBasis {
  const text = note ?? '';
  const modes = new Set(Array.from(text.matchAll(/(?<![\p{L}\p{N}])(선납|분납)(?![\p{L}\p{N}])/gu), (m) => m[1]));
  const reasons: string[] = [];
  if (!modes.size) reasons.push('선납/분납 누락');
  else if (modes.size !== 1) reasons.push('선납/분납 근거가 상충합니다');

  const mentions = Array.from(text.matchAll(/추가보증금/g));
  const amounts = Array.from(text.matchAll(/추가보증금\s*(없음|(?:\d{1,3}(?:,\d{3})+|\d+)\s*원|0)(?=$|[\s;·/()。]|,(?!\d))/g), (m) =>
    m[1] === '없음' ? 0 : Number(m[1].replace(/[,\s원]/g, '')));
  if (!mentions.length) reasons.push('추가보증금 누락');
  else if (amounts.length !== mentions.length || amounts.some((n) => !Number.isSafeInteger(n) || n < 0)) {
    reasons.push('추가보증금 금액을 읽지 못했습니다');
  } else if (new Set(amounts).size !== 1) reasons.push('추가보증금 근거가 상충합니다');
  if (reasons.length) return { status: 'UNKNOWN', reasons };
  return { status: 'KNOWN', prepaid: modes.has('선납'), extraDeposit: amounts[0] };
}

/** 표시 전용. workflowConsistencyIssues 및 저장/진행 차단에 사용하지 않는다. */
export function mewcarPayoutWarning(row: {
  supplier: string | null; note: string | null; term: number | null; payWritten: number | null;
}): { label: string; detail: string } | null {
  if (!isMewcar(row.supplier)) return null;
  const basis = mewcarBasisFromNote(row.note);
  if (basis.status === 'UNKNOWN') return { label: '뮤카 근거 없음', detail: basis.reasons.join(' · ') };
  const expected = mewcarGaPayout({ ...basis, term: row.term ?? NaN });
  if (typeof expected !== 'number') return { label: '뮤카 근거 없음', detail: expected.why };
  if (row.payWritten === expected) return null;
  return {
    label: '뮤카 지급액 확인',
    detail: `지급 기준금액 ${expected.toLocaleString('ko-KR')}원 · 입력액 ${row.payWritten === null || !Number.isFinite(row.payWritten) ? '미확인' : `${row.payWritten.toLocaleString('ko-KR')}원`}`,
  };
}
