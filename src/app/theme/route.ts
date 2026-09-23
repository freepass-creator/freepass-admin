import { NextResponse, type NextRequest } from 'next/server';
import { THEME_COOKIE, safeBack, themeOf } from '../_design/theme';

/**
 * 테마 바꾸기 — `/theme?set=retro&back=/products` (상태바의 「테마」 링크)
 *   목록에 있는 테마만 받고, 되돌아갈 곳은 이 앱 안의 경로만 받는다. 값은 사람마다 쿠키로 1년 기억한다.
 *   관리자 세션 검사는 앞의 proxy 가 그대로 한다(공개 경로가 아니다).
 */
export function GET(req: NextRequest) {
  const theme = themeOf(req.nextUrl.searchParams.get('set'));
  const to = new URL(safeBack(req.nextUrl.searchParams.get('back')), req.nextUrl.origin);
  const res = NextResponse.redirect(to, 303);
  res.cookies.set(THEME_COOKIE, theme, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true });
  return res;
}
