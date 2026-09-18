/**
 * **상품구분 · 심사 · 혜택조건** — ERP5 원자·정책에서 뽑는다.
 *
 * ★대표 2026-09-18 「배차상태 · 상품구분 / 혜택조건(무심사, 21세, 경력무관) 이런 거는 한눈에 보이면 좋은데」
 * ★판정 규칙은 새로 짓지 않았다 — erp4 `lib/domain/product.ts`(creditDisplay · installmentOk · noDeposit ·
 *   minAge · shortExperience · benefitSignals · canonProductType)를 «그대로» 옮겼다.
 *   화이트라벨 손님 화면과 어드민이 같은 차에 다른 혜택을 달면 안 된다. 고치려면 두 곳을 같이 고친다.
 *
 * ★심사조건은 모르면 «모른다» 다 — erp4 머리말: 정책 없는 매물에 근거 없이 「무심사」 가 붙어
 *   손님 카톡과 계약 스냅샷까지 흘러갔다. 여기서도 세 말(무심사·소득확인·신용조회) 중 하나로
 *   읽힐 때만 혜택 줄에 세운다.
 */
type Rec = Record<string, unknown>;
const S = (v: unknown) => String(v ?? '').trim();

/* ── 상품구분 캐논 (erp4 lib/intake/entities.ts PRODUCT_TYPES · PRODUCT_TYPE_LEGACY) ── */
export const PRODUCT_KINDS = ['신차렌트', '중고렌트', '신차구독', '중고구독', '오플구독', '픽업구독', '오공구독'] as const;
const KIND_LEGACY: Record<string, string> = {
  재렌트: '중고렌트', 중고렌트: '중고렌트', 재구독: '중고구독', 중고구독: '중고구독',
  픽업구독: '픽업구독', 오플구독: '오플구독', 오공구독: '오공구독', 손오공구독: '오공구독',
  신차렌트: '신차렌트', 신차구독: '신차구독',
};
export function productKindOf(raw: unknown): string {
  const s = String(raw ?? '').replace(/\s+/g, '');
  if (!s) return '';
  if (/^#(REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!)$/i.test(s)) return '';   // 시트 오류 글자가 새어든 것
  if (KIND_LEGACY[s]) return KIND_LEGACY[s];
  if ((PRODUCT_KINDS as readonly string[]).includes(s)) return s;
  if (s.includes('신차') && s.includes('구독')) return '신차구독';
  if (s.includes('신차')) return '신차렌트';
  if (s.includes('구독')) return '중고구독';
  if (s.includes('렌트') || s.includes('재렌') || s.includes('재랜')) return '중고렌트';
  return s;
}

/* ── 심사 ── */
export const CREDIT_UNSET = '미입력';
export function creditOf(atom: Rec, policy: Rec): string {
  const v = S(policy.screening_criteria) || S(atom.screening_criteria) || S(atom.credit_grade) || S(policy.credit_grade);
  if (/무심사|신용 *무관|소득 *무관|저신용/.test(v)) return '무심사';
  if (/신용 *조회|신용 *필요|신용 *확인|신용 *심사|중신용|고신용|등급|심사\s*필|심사\s*필요/.test(v)) return '신용조회';
  if (/소득 *확인|소득 *조회|소득확|소득 *증빙/.test(v)) return '소득확인';
  return v || CREDIT_UNSET;
}

/* ── 혜택 ── */
const installmentOk = (atom: Rec, policy: Rec) => {
  const v = S(policy.deposit_installment) || S(atom.deposit_installment);
  return !!v && !/불가|불가능|없음|해당\s*없/.test(v);
};
/** ★모든 유료 기간의 보증금이 0 일 때만 — 한 기간만 비어 0 으로 읽혀 무보증이 붙던 버그를 erp4 가 한 번 겪었다 */
const noDeposit = (atom: Rec, deposits: (number | undefined)[]) => {
  if (atom.deposit_free === true || S(atom.deposit_free) === '예') return true;
  return deposits.length > 0 && deposits.every((d) => d === 0);
};
const twoDigit = (s: unknown) => { const m = S(s).match(/(\d{2})/); return m ? Number(m[1]) : 0; };
const minAge = (policy: Rec) => {
  const c = [twoDigit(policy.basic_driver_age), twoDigit(policy.driver_age_lowering)].filter((a) => a >= 18 && a <= 40);
  return c.length ? Math.min(...c) : 0;
};
const shortExperience = (policy: Rec) => {
  const lp = S(policy.license_period);
  if (!lp) return false;
  return /제한없음|무관/.test(lp) || /개월/.test(lp);   // 「3·6개월 이상」 = 1년 미만도 된다
};

/**
 * 한 줄에 세울 조건 — ★차례가 뜻이다: 심사가 맨 앞(사장님 2026-08-28 「맨 앞에 심사조건」).
 *   목록을 훑는 사람이 제일 먼저 거르는 값이 「이 손님이 탈 수 있나」 다.
 * @param deposits 유료 기간(대여료가 있는 Offer)의 보증금 — 모르면 undefined
 */
export function perksOf(atom: Rec, policy: Rec | undefined, deposits: (number | undefined)[]): string[] {
  const pol = policy ?? {};
  const out: string[] = [];
  const credit = creditOf(atom, pol);
  if (credit === '무심사' || credit === '소득확인' || credit === '신용조회') out.push(credit);
  if (installmentOk(atom, pol)) out.push('분납가능');
  if (noDeposit(atom, deposits)) out.push('무보증');
  const age = minAge(pol);
  if (age > 0 && age <= 21) out.push(`만${age}세`);
  if (shortExperience(pol)) out.push('경력무관');
  if (S(atom.accident_history).replace(/\s+/g, '') === '무사고') out.push('무사고');
  return out;
}
