'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE } from '../../server/auth';

/**
 * 로그아웃 — 쿠키만 지우면 끝이다. 구글 세션(g1.…)은 우리가 서명한 봉투라 서버에 끊을 상태가 없다.
 * ★로그인 액션은 없다 — 들어오는 문은 /login/google 하나다(src/server/google-login.ts).
 */
export async function logoutAction(): Promise<void> {
  (await cookies()).delete(AUTH_COOKIE);
  redirect('/login');
}
