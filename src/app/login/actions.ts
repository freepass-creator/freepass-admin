'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE, SESSION_MS, signIn, signOut } from '../../server/auth';

/**
 * 로그인 · 로그아웃 — 규칙은 src/server/auth.ts. 여기는 쿠키만 다룬다.
 * 폼 칸: email · password · next(돌아갈 곳, 선택)
 */
export type LoginState = { error: string } | null;

/** ★돌아갈 곳은 우리 안쪽 경로만 — 남의 주소로 튕기는 길을 막는다 */
const safeNext = (v: unknown) => { const s = String(v ?? ''); return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/login') ? s : '/'; };

export async function loginAction(_: LoginState, f: FormData): Promise<LoginState> {
  const r = await signIn(String(f.get('email') ?? ''), String(f.get('password') ?? ''));
  if (!r.ok) return { error: r.error };
  (await cookies()).set(AUTH_COOKIE, r.cookie, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: Math.floor(SESSION_MS / 1000),
  });
  redirect(safeNext(f.get('next')));
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  await signOut(jar.get(AUTH_COOKIE)?.value);
  jar.delete(AUTH_COOKIE);
  redirect('/login');
}
