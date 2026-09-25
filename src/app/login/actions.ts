'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE, SESSION_MS, signIn, signOut } from '../../server/auth';
import { safeNextPath } from '../../server/safe-next';

/**
 * 로그인 · 로그아웃 — 규칙은 src/server/auth.ts. 여기는 쿠키만 다룬다.
 * 폼 칸: email · password · next(돌아갈 곳, 선택)
 */
export type LoginState = { error: string } | null;


export async function loginAction(_: LoginState, f: FormData): Promise<LoginState> {
  const r = await signIn(String(f.get('email') ?? ''), String(f.get('password') ?? ''));
  if (!r.ok) return { error: r.error };
  (await cookies()).set(AUTH_COOKIE, r.cookie, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: Math.floor(SESSION_MS / 1000),
  });
  redirect(safeNextPath(f.get('next')));  // ★돌아갈 곳은 우리 안쪽 경로만
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  await signOut(jar.get(AUTH_COOKIE)?.value);
  jar.delete(AUTH_COOKIE);
  redirect('/login');
}
