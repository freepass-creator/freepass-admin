import { cookies } from 'next/headers';
import { AUTH_COOKIE, authEnforced, verifySession } from './auth';

/**
 * **서버 액션 안의 문** — proxy.ts 만 믿지 않는다.
 * ★Next 서버 액션은 «어느 주소로든» 불릴 수 있다 — 열어 둔 청구 링크(/c/…) 주소로 관리자 액션(발행·수금·원장 쓰기)을
 *   부르면 proxy 는 경로만 보고 통과시킨다. 그래서 관리자 액션은 첫 줄에서 세션을 «다시» 본다.
 * @returns 막아야 하면 사람이 읽을 까닭, 지나가도 되면 null
 */
export async function requireAdmin(): Promise<string | null> {
  if (!authEnforced()) return null;
  const user = await verifySession((await cookies()).get(AUTH_COOKIE)?.value);
  return user ? null : '로그인이 필요합니다 — 다시 로그인해 주세요';
}
