/**
 * **접수 → 분납실적 / 완납실적 → 완납·인도 기준 청구·지급.**
 *
 * ★대표 2026-09-18 「접수 -> 분납실적/완납실적 -> 완납인도기준으로 청구 및 지급」
 *                  「인도는 사람이 찍어 줄거야... 그러면 너는 완납여부를 따져서 청구할수 있는거지」
 *
 * 규칙은 erp4 `lib/domain/settlement-stage.ts` 를 «그대로» 옮겼다 (사장님 2026-08-25 · 08-26 · 09-01 결정이 거기 박혀 있다).
 *   ⚠ erp4 에는 청구월 규칙이 하나 더 있었다(settlement-billing-month.ts — 인도 전 «예정» · 분납을 접수일부터).
 *     대표 2026-09-18 흐름과 맞는 것은 이쪽이다. 그쪽(month.ts)은 더 쓰지 않는다.
 *
 * ── 사람이 찍는 것 · 기계가 따지는 것
 *   사람   인도(인도완료 + 인도일) · 받은 회차(분납이 «끊겼을 때» 멈춘 회차)
 *   기계   완납인가 · 끊겼나 · 어느 달에 청구·지급하나 · 얼마를(끊기면 받은 만큼)
 *
 * ── 분납 (사장님 2026-08-25 「1회차는 인도 때 낸다」)
 *   k회차 예정일 = 인도일 + (k−1)개월 · 마지막 납입 = 인도일 + (회차−1)개월 · 완료 판정 = 인도일 + 회차개월(한 달 여유)
 *   받은 회차 — ★적혀 있으면 그 값 · 없으면 기간 비례(예정일이 지났으면 받은 것)
 *   끊김     — ★받은 회차가 «적혀» 있어야 말할 수 있다. 안 적혔으면 기간 비례라 늘 「받은 것」 이다
 *
 * ── 청구월 (인도가 관문)
 *   박힌 청구월 > 인도 전은 없음(null = 「아직」) > 일시납 인도월 > 분납 정상 마지막 납입월 > 분납 끊김 받은 회차의 달
 *   ★2026-09-01 부터 «모든» 분납은 완납 시점 청구 — 인도월이 2026-09 앞이면 옛 규칙(인도월) 그대로(지난 달을 흔들지 않는다)
 *   ★박힌 달은 닫혔다 — 계산으로 늦게 들어오는 줄이 그 달을 흔들지 않는다(null → 「청구월 미정」, 사람이 정한다)
 */
import type { Maybe, SettlementRow } from './types';

const S = (v: unknown) => String(v ?? '').trim();
const p2 = (n: number) => String(n).padStart(2, '0');
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 업무 달력은 Asia/Seoul 고정. 서버(UTC)·브라우저(KST)가 같은 사실을 다르게 판정하지 않는다. */
const businessParts = (d: Date) => {
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  return { y: kst.getUTCFullYear(), m: kst.getUTCMonth(), d: kst.getUTCDate() };
};
export const ym = (d: Date) => {
  const x = businessParts(d);
  return `${x.y}-${p2(x.m + 1)}`;
};

/** 저장된 날짜는 실제 달력 날짜만 받는다. JS Date overflow(2026-02-30 → 03-02)를 사실로 만들지 않는다. */
const dateOf = (v: unknown): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(S(v));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo, day));
  return d.getUTCFullYear() === y && d.getUTCMonth() === mo && d.getUTCDate() === day ? d : null;
};

/**
 * 달을 더할 때 원래 일자가 대상 월에 없으면 그 달의 마지막 날로 붙인다.
 * 예: 2026-01-31 + 1개월 = 2026-02-28, 2026-10-31 + 1개월 = 2026-11-30.
 * 날짜-only 값은 UTC 자정으로 들고 계산해 실행 환경 timezone에 영향받지 않는다.
 */
const addMonths = (d: Date, n: number) => {
  const targetFirst = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), Math.min(d.getUTCDate(), lastDay)));
};
const dayText = (d: Date) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;

/** ★«오늘»은 한국 업무일의 자정이다. */
export const midnight = (d = new Date()) => {
  const x = businessParts(d);
  return new Date(Date.UTC(x.y, x.m, x.d));
};

export const roundsOf = (payKind: unknown) => { const m = /(\d+)\s*회/.exec(S(payKind)); const n = m ? Number(m[1]) : 1; return n >= 2 ? n : 1; };

type R = Pick<SettlementRow, 'payKind' | 'receivedAt' | 'supplier'> & {
  progress: Pick<SettlementRow['progress'], 'delivered' | 'deliveredAt' | 'cancelled' | 'billMonth'>
    & Partial<Pick<SettlementRow['progress'], 'billed' | 'invoiceIssued' | 'collected' | 'paid' | 'settleExclude'>>;
  paidRounds?: Maybe<number>;
  /** 실제 납입회차를 사람이 확인한 업무일. I/F가 persistence 원자를 공급하면 E가 완납 청구월에 사용한다. */
  paidRoundsAt?: Maybe<string>;
  claimStage?: SettlementRow['claimStage'];
  payStage?: SettlementRow['payStage'];
};
const deliveredDay = (r: R) => (r.progress.delivered ? dateOf(r.progress.deliveredAt) : null);

export const lastPaymentDate = (r: R) => { const n = roundsOf(r.payKind), d = deliveredDay(r); return n >= 2 && d ? addMonths(d, n - 1) : null; };
export const instalmentDueDate = (r: R) => { const n = roundsOf(r.payKind), d = deliveredDay(r); return n >= 2 && d ? addMonths(d, n) : null; };

/** 몇 회차까지 받았나 — 적혀 있으면 그 값, 없으면 기간 비례. 인도됐으면 1회차는 받은 것 */
export function paidRoundsOf(r: R, now = new Date()): number {
  const n = roundsOf(r.payKind), d = deliveredDay(r);
  if (!d) return 0;
  const w = Number(r.paidRounds);
  if (r.paidRounds !== null && r.paidRounds !== undefined && Number.isInteger(w) && w >= 1) return Math.min(n, w);
  const today = midnight(now);
  let paid = 1;
  for (let k = 2; k <= n; k += 1) if (addMonths(d, k - 1) <= today) paid = k;
  return paid;
}

/**
 * F04 「다음회차일」 — 인도 시 1회차를 낸 것으로 보고 다음 예정일을 보여 준다.
 * paidRounds를 사람이 확정한 경우 그 다음 회차를 가리키며, 완납이면 null.
 * 날짜가 지났다고 자동으로 '받았다'고 확정하지 않는다.
 */
export function nextInstallmentDate(r: R): string | null {
  const n = roundsOf(r.payKind), d = deliveredDay(r);
  if (n < 2 || !d) return null;
  const written = Number(r.paidRounds);
  const paid = r.paidRounds !== null && r.paidRounds !== undefined && Number.isInteger(written) && written >= 1
    ? Math.min(n, written)
    : 1;
  if (paid >= n) return null;
  const next = addMonths(d, paid);
  return dayText(next);
}

/** 끊겼나 — 받아야 할 날이 지났는데 못 받았다 */
export function brokenOf(r: R, now = new Date()): boolean {
  const n = roundsOf(r.payKind), d = deliveredDay(r);
  if (n < 2 || !d) return false;
  const paid = paidRoundsOf(r, now);
  if (paid >= n) return false;
  return addMonths(d, paid) < midnight(now);
}

/** 받은 만큼의 몫 — 끊긴 분납만 1 보다 작다 */
export const paidRatioOf = (r: R, now = new Date()) => (roundsOf(r.payKind) < 2 || !brokenOf(r, now) ? 1 : paidRoundsOf(r, now) / roundsOf(r.payKind));

/** 스타·아이카는 분납이 끊기면 지급이 «아예» 없다 (사장님 2026-08-25) */
export const NO_PAY_IF_BROKEN = [/스타/, /아이카/];
export const noPayIfBroken = (r: Pick<SettlementRow, 'supplier'>) => NO_PAY_IF_BROKEN.some((re) => re.test(r.supplier ?? ''));

/** 2026-09-01 부터 모든 분납은 완납 시점 청구 — 인도월 기준 시행 */
export const CLAIM_ON_COMPLETE_SINCE = '2026-09';
export function claimsOnComplete(r: R): boolean {
  if (roundsOf(r.payKind) < 2) return false;
  const d = deliveredDay(r);
  if (!d) return true;
  return ym(d) >= CLAIM_ON_COMPLETE_SINCE || noPayIfBroken(r);
}

/** 청구월 — 인도가 관문. null 은 「아직」 이다 */
export function billingMonth(r: R, now = new Date()): string | null {
  const d = deliveredDay(r);
  if (!d) return null;
  const written = S(r.progress.billMonth);
  if (written) return MONTH.test(written) ? written : null;
  if (!claimsOnComplete(r)) return ym(d);

  const rounds = roundsOf(r.payKind);
  const paid = Number(r.paidRounds);
  const explicitlyComplete = r.paidRounds !== null && r.paidRounds !== undefined
    && Number.isInteger(paid) && paid >= rounds;
  if (explicitlyComplete) {
    const completedAt = dateOf(r.paidRoundsAt);
    // 완납 시점 청구인데 실제 완납일을 모르면 예정월을 사실처럼 만들지 않는다.
    return completedAt ? ym(completedAt) : null;
  }

  if (brokenOf(r, now)) return ym(addMonths(d, Math.max(0, paidRoundsOf(r, now) - 1)));
  const last = lastPaymentDate(r);
  return last ? ym(last) : ym(d);
}

/**
 * 닫힌 달.
 * - 현재 운영의 월마감은 반드시 별도 CLOSED 사실로 들어온다. 청구서/지급명세 발행을 월마감으로 추정하지 않는다.
 * - 과거 legacy 월은 이미 박힌 billMonth를 보호하기 위해 현재월 이전의 확정월만 잠근다.
 * - 인도 전·취소·정산제외 행의 stale billMonth는 legacy 잠금 근거가 될 수 없다.
 */
export function lockedMonthsOf(
  rows: readonly R[],
  now = new Date(),
  explicitlyClosed: ReadonlySet<string> = new Set<string>(),
): Set<string> {
  const current = ym(now);
  const out = new Set<string>(
    [...explicitlyClosed].filter((m) => MONTH.test(m)),
  );
  for (const r of rows) {
    const written = S(r.progress.billMonth);
    if (!MONTH.test(written) || written >= current) continue;
    if (!deliveredDay(r) || r.progress.cancelled || r.progress.settleExclude) continue;
    out.add(written);
  }
  return out;
}

/** 닫힌 달을 흔들지 않는 청구월 — null 이면 「청구월 미정」 (사람이 정한다) */
export function billingMonthIn(r: R, locked: ReadonlySet<string>, now = new Date()): string | null {
  const m = billingMonth(r, now);
  if (!m) return null;
  if (S(r.progress.billMonth)) return m;
  return locked.has(m) ? null : m;
}

/**
 * 계약이 앉는 자리 — 접수 · 분납실적 · 완납실적 · 취소.
 * F04 현행 매뉴얼: 인도완료를 체크하면 접수에서 바로 빠져,
 * 분납이면 분납실적 / 일시납이면 완납실적으로 간다.
 */
export type Stage = '접수' | '분납실적' | '완납실적' | '취소';
export function stageOf(r: R, now = new Date()): Stage {
  if (r.progress.cancelled) return '취소';
  const d = deliveredDay(r);
  if (!d) return '접수';

  const rounds = roundsOf(r.payKind);
  if (rounds < 2) return '완납실적';

  // 사람이 전체 회차 납입을 명시했다면 날짜 여유기간을 기다리지 않고 완료 사실이 이긴다.
  const written = Number(r.paidRounds);
  const explicitlyComplete = r.paidRounds !== null && r.paidRounds !== undefined
    && Number.isInteger(written) && written >= rounds;
  if (explicitlyComplete) return '완납실적';

  const due = instalmentDueDate(r);
  return due && due >= midnight(now) ? '분납실적' : '완납실적';
}

/**
 * 사람이 보는 칸 — 접수를 둘로 가른다 (사장님 2026-08-26 「당월접수탭 있고 미완료탭 있어서」)
 *   당월접수  이번 달에 받은 계약 — 인도됐든 아니든 이 달 실적
 *   미완료    지난달 이전에 받았는데 아직 차가 안 나간 것 — ★위에 오래 있을수록 위험하다
 */
export type Bucket = '당월접수' | '미완료' | '분납실적' | '완납실적' | '취소';
export const BUCKETS: Bucket[] = ['당월접수', '미완료', '분납실적', '완납실적', '취소'];
export function bucketOf(r: R, now = new Date()): Bucket {
  const s = stageOf(r, now);
  if (s !== '접수') return s;
  return r.receivedAt && S(r.receivedAt).slice(0, 7) === ym(midnight(now)) ? '당월접수' : '미완료';
}
