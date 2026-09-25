import { NextResponse, type NextRequest } from 'next/server';
import { OAUTH_COOKIE, googleLoginReady, startGoogle } from '../../../server/google-login';

/** 구글 워크스페이스 로그인 시작 — 규칙은 src/server/google-login.ts */
export async function GET(req: NextRequest) {
  const back = new URL('/login', req.nextUrl.origin);
  if (!googleLoginReady()) { back.searchParams.set('error', '구글 로그인 설정이 아직 없습니다'); return NextResponse.redirect(back); }
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const safe = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/';
  const { url, cookie } = startGoogle(req.nextUrl.origin, safe);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/login/google', maxAge: 600 });
  return res;
}
