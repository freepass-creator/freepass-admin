/**
 * **ERP5 원자 한 칸을 읽는 공통 방법 — 한 곳에서만 정한다.**
 *
 * ★왜 — 「글자를 다듬고 숫자로 읽는」 같은 일을 6곳(to-canonical · contract-repository · extras ·
 *   perks · photos · settlement-repository)이 «각자» 다시 썼다. 겉보기엔 같은 정규식인데
 *   «못 읽으면 무엇을 주나» 가 파일마다 갈려 있었다(undefined · null · 0 · «truthy 먼저 본 뒤 0»).
 *   한 곳을 고쳐도 나머지 다섯은 그대로 남는다 — 그게 드리프트다.
 *
 * ★이름에 «실패하면 무엇을 주나» 를 박아 둔다 — 고르는 사람이 뜻을 다시 안 찾아도 되게.
 *   숫자 «0」과 «모른다」를 섞지 않는다(이 저장소의 오래된 규율 — 정본 파일 CLAUDE.md 「대수는 세지 말고 읽는다」와 같은 결).
 */

/** 글자로 다듬는다 — 앞뒤 공백만 벗긴다. 없으면 빈 글자. */
export const strOf = (v: unknown): string => String(v ?? '').trim();

/** 빈 글자는 undefined — `??` 로 기본값을 잇는 자리(옵셔널 칸)에 쓴다. */
export const strOrUndef = (v: unknown): string | undefined => strOf(v) || undefined;

/** 콤마·공백·「원」을 버리고 숫자로. 못 읽으면 null — 바로 안 내보낸다(아래 세 함수가 「없을 때 뭘 주나」를 고른다). */
const bareNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = strOf(v).replace(/[,\s원]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** 못 읽으면 undefined — 제원 칸(연식·주행거리·배기량 …)처럼 없는 게 정상인 자리. */
export const numOrUndef = (v: unknown): number | undefined => bareNumber(v) ?? undefined;

/** 못 읽으면 null — `Maybe<number>` 로 도메인에 들고 갈 칸. */
export const numOrNull = (v: unknown): number | null => bareNumber(v);

/** 못 읽으면 0 — 이미 계산에 쓸 것이 정해진 칸(합계 등)에만. 「모른다」를 지워도 되는 자리에서만 쓴다. */
export const numOrZero = (v: unknown): number => bareNumber(v) ?? 0;

/** 못 읽거나 0 이하면 undefined — 「양수만 뜻이 있다」 칸(가격 등). 0원·음수는 «안 적힌 것과 같다»로 본다. */
export const positiveNumOrUndef = (v: unknown): number | undefined => {
  const n = bareNumber(v);
  return n !== null && n > 0 ? n : undefined;
};
