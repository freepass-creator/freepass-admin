'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE } from '../../server/auth';
import { revokeSessions } from '../../server/identity';

/**
 * 로그아웃 — 쿠키를 지우고 Firebase 쪽 세션도 끊는다(다른 기기 포함).
 * ★로그인 액션은 없다. 들어오는 문은 공용 로그인 화면 → `/api/session` 하나다.
 */
export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const cookie = jar.get(AUTH_COOKIE)?.value;
  if (cookie) await revokeSessions(cookie).catch(() => {});
  jar.delete(AUTH_COOKIE);
  redirect('/login');
}
