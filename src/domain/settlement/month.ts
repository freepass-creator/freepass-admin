/**
 * **그 줄이 «어느 달에 실리나».**  erp4 `lib/domain/settlement-billing-month.ts` `settlementMonthOf` 를 그대로 옮겼다.
 *   원장·공급사시트·영업채널시트가 «같은 달» 을 말해야 한다 — 규칙을 새로 짓지 않는다. 고치려면 두 곳을 같이.
 *
 *   ① 박힌 청구월이 이긴다 — 사람이 정한 달을 계산이 덮으면 이미 나간 종이와 갈린다
 *   ② 분납은 «접수일» 에서 센다 — 접수월 + (회차−1) (사장님 2026-09-04 「분납완료되는 날이 청구월」)
 *   ③ 일시납은 인도월
 *   ④ 인도 전이면 «접수월» 을 예정월로 — 사장님 2026-09-08 「접수가 되면 청구서에 미리 올라가 있는 거지」
 *      안 보이는 줄은 아무도 안 찾는다. 인도가 찍히면 제 달로 옮겨 간다.
 */
const S = (v: unknown) => String(v ?? '').trim();
const p2 = (n: number) => String(n).padStart(2, '0');
const dateOf = (v: unknown): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(S(v));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const ymOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;

/** 「2회분납」 → 2. 회차가 없으면 1(일시납). */
export const roundsOf = (k: unknown) => { const m = /(\d)\s*회/.exec(S(k)); const n = m ? Number(m[1]) : 1; return n >= 2 ? n : 1; };

export type MonthBasis = 'WRITTEN' | 'INSTALLMENT' | 'DELIVERED' | 'FORECAST';

export function settlementMonthOf(r: { billMonth?: unknown; receivedAt?: unknown; deliveredAt?: unknown; payKind?: unknown }):
  { month: string; basis: MonthBasis } | null {
  const written = S(r.billMonth);
  if (written) return { month: written, basis: 'WRITTEN' };
  const n = roundsOf(r.payKind);
  if (n >= 2) {
    const rc = dateOf(r.receivedAt);
    return rc ? { month: ymOf(new Date(rc.getFullYear(), rc.getMonth() + (n - 1), rc.getDate())), basis: 'INSTALLMENT' } : null;
  }
  const d = dateOf(r.deliveredAt);
  if (d) return { month: ymOf(d), basis: 'DELIVERED' };
  const rc = dateOf(r.receivedAt);
  return rc ? { month: ymOf(rc), basis: 'FORECAST' } : null;
}
