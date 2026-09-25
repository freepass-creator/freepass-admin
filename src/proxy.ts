import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, authEnforced, isPublicPath, verifySession } from './server/auth';
import { esignEnabled, isEsignPath } from './server/esign-scope';

/**
 * **모든 요청 앞의 문** (Next 16 proxy · Node 에서 돈다).
 * ★어드민 화면과 서버 액션(같은 주소로 POST)은 관리자 세션이 있어야 지나간다.
 * ★청구 링크(/c/…) · 사진(/api/img) · 로그인은 열어 둔다 — 공급사는 우리 계정이 없다.
 * 규칙은 전부 src/server/auth.ts 에 있다.
 */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  /* ★전자계약은 운영 개시 범위 밖 — ESIGN_ENABLED=on 전에는 화면·고객 링크·API 모두 닫는다(src/server/esign-scope.ts) */
  if (!esignEnabled() && isEsignPath(path)) {
    if (path === '/esign' && req.method === 'GET') { const to = req.nextUrl.clone(); to.pathname = '/intake'; to.search = ''; return NextResponse.redirect(to); }
    return path.startsWith('/api/')
      ? NextResponse.json({ error: '전자계약은 현재 운영 범위가 아닙니다' }, { status: 404 })
      : new NextResponse('Not Found', { status: 404 });
  }
  if (!authEnforced() || isPublicPath(path)) return NextResponse.next();
  const user = await verifySession(req.cookies.get(AUTH_COOKIE)?.value);
  if (user) return NextResponse.next();
  if (req.method !== 'GET' || path.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }
  const to = req.nextUrl.clone();
  to.pathname = '/login';
  to.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
  return NextResponse.redirect(to);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
