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
     * F04 수수료표 169·170행 — 확정(뮤카가 10-03 보낸 조건표 «영업 GA 지급 수수료율» · 대표 10-03 결정 —
     * 근거 상세는 비공개 운영 기록).
     * ★금액은 공개 코드에 두지 않는다(AI 상황실 10-05 — 정본 하나 원칙 + 거래 조건 공개 노출). 금액은 프리패스 데이터 수수료 규칙이 정본이다.
     * ★auto=false — 정액이 «보증금 선납/분납 × 기간» 으로 갈리고 «추가보증금 가산»이 붙는데, 접수에는 추가보증금 칸이 없고
     *   feeOf 는 선납/분납을 받지 않는다. 자동으로 세면 가산이 빠져 조용히 적게 나온다. 접수 때 사람이 넣는다(넣은 값이 이긴다).
     */
    supplier: '뮤카', kind: '구독', form: '', term: 0, basis: '조건분기',
    claim: '차량 기준가 × 요율 (프리패스 몫 · 별도 지급) — 금액은 프리패스 데이터 수수료 규칙',
    pay: '영업 GA 정액(보증금 선납/분납 × 기간) + 추가보증금 가산 — 금액은 프리패스 데이터 수수료 규칙',
    when: '보증금 분납 완납 전 미지급', auto: false,
    note: '확정 — 뮤카가 보낸 조건표(상세는 비공개 운영 기록). 프리패스 몫과 GA 정액을 별도로 둘 다 지급(서로 빼지 않음) · 지급 기준금액 VAT 포함 또는 원천세 포함 · 차급 구분 없음',
  },
];

/** 원장·메일에 「무카」로도 적힌다(2026-10-01 메일 발신명) */
export const F04_EXTRA_ALIASES: Record<string, string> = { 무카: '뮤카' };

export function isMewcar(supplier: string | null | undefined): boolean {
  const name = headOf(supplier ?? '');
  return (F04_EXTRA_ALIASES[name] ?? name) === '뮤카';
}

type UnknownPayout = { status: 'UNKNOWN'; why: string };

/**
 * 뮤카 영업 GA 지급표 — ★정본은 프리패스 데이터 수수료 규칙이다. 공개 코드에 금액을 두지 않는다(AI 상황실 10-05).
 * 규칙을 읽어 넘겨 줄 때만 계산하고, 없으면(null) 계산하지 않고 «모른다».
 */
export interface MewcarGaTable {
  /** 보증금 선납·분납별, 계약기간(개월)별 정액 */
  prepaid: Record<number, number>;
  installment: Record<number, number>;
  /** 추가보증금 가산 요율과 상한 */
  extraRate: number;
  extraCap: number;
}

/** 지급 기준금액(VAT/원천세 포함). 지급 가능 여부, 프리패스 몫은 계산하지 않는다.
 * 분납은 완납 전 미지급이며, 이 비교용 계산이 auto:false를 대체하지 않는다.
 */
export function mewcarGaPayout({ prepaid, term, extraDeposit }: {
  prepaid: boolean; term: number; extraDeposit: number;
}, table: MewcarGaTable | null): number | UnknownPayout {
  if (!table) return { status: 'UNKNOWN', why: '프리패스 데이터에 뮤카 수수료 규칙이 아직 없음 — 대조하지 않음' };
  if (typeof prepaid !== 'boolean') return { status: 'UNKNOWN', why: '보증금 선납/분납 미확인' };
  const base = (prepaid ? table.prepaid : table.installment)[term];
  if (!Number.isSafeInteger(term) || !Number.isSafeInteger(base) || base < 0) return { status: 'UNKNOWN', why: `계약기간 ${term}개월 규칙 없음` };
  if (!Number.isSafeInteger(extraDeposit) || extraDeposit < 0) {
    return { status: 'UNKNOWN', why: '추가보증금은 0 이상의 안전한 정수 금액이어야 합니다' };
  }
  if (!(table.extraRate >= 0) || !Number.isSafeInteger(table.extraCap) || table.extraCap < 0) return { status: 'UNKNOWN', why: '추가보증금 가산 규칙이 비정상' };
  const extra = extraDeposit * table.extraRate;
  /* 가산에 원 미만이 생기면 모른다 — 원 단위 처리 규정이 아직 없다 */
  if (!Number.isInteger(extra)) return { status: 'UNKNOWN', why: '추가보증금 가산에 원 미만이 생김 — 원 단위 처리 미확정' };
  return base + Math.min(extra, table.extraCap);
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
}, table: MewcarGaTable | null = null): { label: string; detail: string } | null {
  if (!isMewcar(row.supplier)) return null;
  const basis = mewcarBasisFromNote(row.note);
  if (basis.status === 'UNKNOWN') return { label: '뮤카 근거 없음', detail: basis.reasons.join(' · ') };
  /* 규칙이 없으면 계산하지 않는다 — «모른다»만 표시 */
  if (!table) return { label: '뮤카 금액 모름', detail: '프리패스 데이터에 뮤카 수수료 규칙이 아직 없어 지급액을 대조하지 않음' };
  const expected = mewcarGaPayout({ ...basis, term: row.term ?? NaN }, table);
  if (typeof expected !== 'number') return { label: '뮤카 근거 없음', detail: expected.why };
  if (row.payWritten === expected) return null;
  return {
    label: '뮤카 지급액 확인',
    detail: `지급 기준금액 ${expected.toLocaleString('ko-KR')}원 · 입력액 ${row.payWritten === null || !Number.isFinite(row.payWritten) ? '미확인' : `${row.payWritten.toLocaleString('ko-KR')}원`}`,
  };
}

/**
 * 프리패스 데이터 수수료 규칙 문서의 `gaTable` 칸을 엄격히 읽는다 — 모양이 하나라도 틀리면 null(«모른다»).
 * 기대 모양: { prepaid: { "<개월>": 정액 }, installment: { "<개월>": 정액 }, extraRate: 0~1, extraCap: 0 이상 정수 }
 */
export function parseMewcarGaTable(raw: unknown): MewcarGaTable | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const terms = (x: unknown): Record<number, number> | null => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      const t = Number(k);
      if (!Number.isSafeInteger(t) || t <= 0 || typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return null;
      out[t] = v;
    }
    return Object.keys(out).length ? out : null;
  };
  const prepaid = terms(o.prepaid), installment = terms(o.installment);
  const extraRate = o.extraRate, extraCap = o.extraCap;
  if (!prepaid || !installment) return null;
  if (typeof extraRate !== 'number' || !(extraRate >= 0 && extraRate <= 1)) return null;
  if (typeof extraCap !== 'number' || !Number.isSafeInteger(extraCap) || extraCap < 0) return null;
  return { prepaid, installment, extraRate, extraCap };
}

/** 표 읽기가 실패해도 화면·다른 공급사 계산·저장을 깨지 않는다 — 실패는 null(«뮤카 금액 모름»). */
export async function mewcarGaTableOrNull(load: () => Promise<MewcarGaTable | null>): Promise<MewcarGaTable | null> {
  try { return await load(); }
  catch (e) { console.warn(`[ledger] 뮤카 지급표를 읽지 못했다 — 금액 모름으로 둔다: ${(e as Error).message}`); return null; }
}
