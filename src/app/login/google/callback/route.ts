import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE } from '../../../../server/auth';
import { GOOGLE_SESSION_MS, OAUTH_COOKIE, finishGoogle } from '../../../../server/google-login';
import { sameOriginRedirect } from '../../../../server/safe-next';

/** 구글에서 돌아오는 곳 — 워크스페이스 사람이면 세션을 주고, 아니면 /login 에 까닭을 남긴다 */
export async function GET(req: NextRequest) {
  const r = await finishGoogle(req.nextUrl.origin, { code: req.nextUrl.searchParams.get('code'), state: req.nextUrl.searchParams.get('state') }, req.cookies.get(OAUTH_COOKIE)?.value);
  const res = r.ok
    ? NextResponse.redirect(sameOriginRedirect(r.next, req.nextUrl.origin))
    : NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(r.error)}`, req.nextUrl.origin));
  res.cookies.delete({ name: OAUTH_COOKIE, path: '/login/google' });
  if (r.ok) res.cookies.set(AUTH_COOKIE, r.session, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: Math.floor(GOOGLE_SESSION_MS / 1000) });
  return res;
}
