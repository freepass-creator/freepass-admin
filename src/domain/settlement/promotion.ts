/**
 * 프로모션 — 접수할 때 넣는다.
 *
 * ★대표 2026-09-17
 *   「프로모션 하는게 있으니까 접수할때 프로모션 업셀링 금액을 넣어야함」
 *   「프로모션 반영금액이 있고 영업자 지급 비율을 넣을수 있게끔 —
 *     즉 프로모션 하는걸 영업자한테 얼마 더 줄거냐.
 *     추가 50인데 50 다 줄거면 100% 로 해놓으면 되고, 기본 100%로 세팅」
 *
 * 그래서 사람이 넣는 것은 «둘» 이다 —
 *
 *   ① 프로모션 금액   공급사에서 «더 받는» 것
 *   ② 영업자 지급 비율 그중 영업자에게 «얼마를 넘길지». ★기본 100%
 *
 * 나머지는 파생이다. 사람이 세 번째 수를 적지 않는다 —
 * 적게 하면 ①②와 어긋나고, 어긋나면 어느 것이 맞는지 아무도 모른다.
 *
 * ```
 *   공급사에게 받는다  = 기본 수수료 + 프로모션
 *   영업자에게 준다    = 기본 지급   + 프로모션 × 비율
 *   우리에게 남는다    = (기본 수수료 − 기본 지급) + 프로모션 × (1 − 비율)
 * ```
 *
 * ★F04 시트에 이 꼴이 «이미» 있다 (실측 17하3915) —
 *   공급사인센티브 300,000 → 에이전시인센티브 300,000 = 비율 100%.
 *   그래서 새 칸을 만드는 게 아니라 «있는 칸에 이름을 주는» 일이다.
 */

/** 사람이 넣는 둘. ★비율은 0~1 이다 (100% = 1) */
export interface Promotion {
  /** 공급사에서 더 받는 것. ★없으면 null — 0 이 아니다 */
  amount: number | null;
  /**
   * 영업자에게 넘기는 비율. ★기본 1 (=100%, 다 준다).
   * 0 이면 「한 푼도 안 준다」 는 «뜻» 이고, null 이면 「아직 안 정했다」 다.
   */
  agentShare: number | null;
  /** 무슨 프로모션인지. ★사유 없는 돈은 다음 달에 아무도 못 읽는다 */
  reason?: string | null;
}

/** ★비율의 기본값. 대표: 「기본 100%로 세팅해주고」 */
export const DEFAULT_AGENT_SHARE = 1;

export const emptyPromotion = (): Promotion => ({
  amount: null, agentShare: DEFAULT_AGENT_SHARE, reason: null,
});

/**
 * 화면에서 들어오는 «퍼센트» 를 비율로 읽는다. 0~100 만 받는다.
 *
 * ★퍼센트«만» 받는 까닭 — 모호함이 돈을 흘린다.
 *   「1 이하면 비율, 넘으면 퍼센트」 로 하면 사람이 «1% 를 뜻하고 1 을 적었을 때»
 *   기계가 100% 로 읽는다. 프로모션 50만이 통째로 남의 주머니로 간다.
 *   그래서 화면 칸에 「%」 를 붙이고 여기서는 퍼센트로만 읽는다.
 *   저장되는 값은 늘 0~1 이다 — 두 자리를 섞지 않는다.
 */
export function parseSharePercent(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).replace(/[%\s,]/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;   /* ★120% 는 안 받는다 */
  return n / 100;
}

/** 저장된 비율(0~1)이 성한가. 화면 입력에는 쓰지 않는다 */
export function isShare(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

export interface PromotionSplit {
  /** 공급사에서 더 받는 것 */
  claim: number;
  /** 영업자에게 더 주는 것 */
  pay: number;
  /** 우리에게 남는 것 */
  ours: number;
  /** ★사람이 아직 안 정한 것이 있나 */
  pending: boolean;
}

/**
 * 프로모션을 갈라 놓는다.
 *
 * ★비율을 «안 정했으면» 가르지 않는다 — 0 으로 두고 `pending` 을 세운다.
 *   기본값이 100% 이므로 보통은 여기 안 걸린다. 걸리면 사람이 일부러 비운 것이다.
 */
export function splitPromotion(p: Promotion): PromotionSplit {
  const amount = p.amount ?? 0;
  if (!amount) return { claim: 0, pay: 0, ours: 0, pending: false };
  if (p.agentShare === null) return { claim: amount, pay: 0, ours: 0, pending: true };
  const pay = Math.round(amount * p.agentShare);
  return { claim: amount, pay, ours: amount - pay, pending: false };
}

/** 사람에게 보일 한 줄. ★수를 다시 세지 않고 splitPromotion 하나만 쓴다 */
export function describePromotion(p: Promotion): string | null {
  if (!p.amount) return null;
  const s = splitPromotion(p);
  if (s.pending) return `프로모션 ${s.claim.toLocaleString('ko-KR')}원 — ★영업자 지급 비율을 아직 안 정했다`;
  const pct = Math.round((p.agentShare ?? 0) * 100);
  const tail = s.ours === 0 ? '전부 넘긴다'
    : s.pay === 0 ? '전부 우리가 갖는다'
    : `우리 몫 ${s.ours.toLocaleString('ko-KR')}원`;
  return `프로모션 ${s.claim.toLocaleString('ko-KR')}원 · 영업자 ${pct}% (${s.pay.toLocaleString('ko-KR')}원) — ${tail}`;
}

/** 접수가 들고 갈 꼴. ★Snapshot 이라 나중에 프로모션이 바뀌어도 이 건은 안 바뀐다 */
export function promotionFromInput(amountRaw: unknown, shareRaw: unknown, reason?: string | null): Promotion {
  const n = Number(String(amountRaw ?? '').replace(/[,\s원]/g, ''));
  const amount = Number.isFinite(n) && n > 0 ? n : null;
  /* ★금액이 없으면 비율을 묻지 않는다 — 비율만 적힌 줄은 뜻이 없다 */
  if (amount === null) return { amount: null, agentShare: DEFAULT_AGENT_SHARE, reason: null };
  const share = shareRaw === undefined || shareRaw === null || shareRaw === ''
    ? DEFAULT_AGENT_SHARE : parseSharePercent(shareRaw);
  return { amount, agentShare: share, reason: (reason ?? '').trim() || null };
}
