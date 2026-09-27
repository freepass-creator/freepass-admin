import { cookies } from 'next/headers';
import { AUTH_COOKIE, authEnforced, type AdminUser } from './auth';
import { identityFromCookie, type Identity } from './identity';

/**
 * **진짜 문** — proxy 는 쿠키가 있는지만 본다. 여기가 검증한다.
 * ★Next 서버 액션은 «어느 주소로든» 불릴 수 있다 — 열어 둔 청구 링크(/c/…) 주소로 관리자 액션(발행·수금·원장 쓰기)을
 *   부르면 proxy 는 경로만 보고 통과시킨다. 그래서 관리자 액션은 첫 줄에서 세션을 «다시» 본다.
 * ★한 번 부를 때마다 계약 ②③ 이 다 걸린다 — Firebase 세션쿠키 서명·취소 검증 → 프리패스 데이터 권한 →
 *   `APPROVED` + `freepass-admin` grant. 권한 저장소에 못 닿으면 «거절»이다(fail-closed).
 *   권한은 identity.ts 가 최대 5분 들고 있는다(계약 ④).
 */

const asAdmin = (who: Identity): AdminUser => ({ uid: who.uid, name: who.name, role: 'admin', email: who.id });

async function current(): Promise<Identity | null> {
  return identityFromCookie((await cookies()).get(AUTH_COOKIE)?.value);
}

/** @returns 막아야 하면 사람이 읽을 까닭, 지나가도 되면 null */
export async function requireAdmin(): Promise<string | null> {
  if (!authEnforced()) return null;
  return (await current()) ? null : '로그인이 필요합니다 — 다시 로그인해 주세요';
}

/** 지금 로그인한 관리자 — 위 띠에 이름을 띄울 때. 로그인이 꺼진 개발에서는 null */
export async function currentAdmin(): Promise<{ name: string } | null> {
  if (!authEnforced()) return null;
  const who = await current();
  return who ? { name: who.name } : null;
}

/** 마스터인가 — 계정 승인은 프리패스 데이터가 하지만, 이 앱에서도 마스터만 보이는 것이 생길 수 있다 */
export async function currentMaster(): Promise<string | null> {
  const who = await current();
  return who?.role === 'MASTER' ? who.id : null;
}

/** 이력에 남길 «누가» — 기본값 문자열이 아니라 로그인한 그 사람(이름 + 이메일). 로그인이 꺼진 개발에서만 기본값 */
export const DEV_ACTOR = 'freepass-admin';
export function actorLabel(user: { uid: string; name: string; email?: string }): string {
  return `${user.name} <${user.email || user.uid}>`;
}
export async function currentActor(): Promise<string> {
  if (!authEnforced()) return DEV_ACTOR;
  const who = await current();
  if (!who) throw new Error('로그인이 필요합니다 — 다시 로그인해 주세요');
  return actorLabel(asAdmin(who));
}
