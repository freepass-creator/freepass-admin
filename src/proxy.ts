import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, authEnforced, isPublicPath, looksLikeSession } from './server/auth';
import { esignEnabled, isEsignRuntimePath } from './server/esign-scope';

/**
 * **모든 요청 앞의 문** (Next 16 proxy · Node 에서 돈다).
 * ★어드민 화면과 서버 액션(같은 주소로 POST)은 관리자 세션이 있어야 지나간다.
 * ★청구 링크(/c/…) · 사진(/api/img) · 로그인은 열어 둔다 — 공급사는 우리 계정이 없다.
 * 규칙은 전부 src/server/auth.ts 에 있다.
 */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  /* 관리자 전자계약 목록(/esign)은 독립 페이지로 열되, 실제 고객 링크·발행/승인 API는
   * ESIGN_ENABLED=on 전까지 닫는다. 로그인 문이 먼저라 관리자 API는 비로그인 401, 로그인 404다. */
  const esignClosed = !esignEnabled() && isEsignRuntimePath(path);
  if (!authEnforced() || isPublicPath(path)) return esignClosed ? closedEsign(req, path) : NextResponse.next();
  /* ★쿠키가 «있는지»만 본다 — 모든 요청 앞이라 firebase-admin 을 싣지 않는다.
     진짜 검증(서명 · 취소 · 승인 · grant)은 require-admin.ts 가 쪽과 서버 액션 앞에서 한다. */
  if (looksLikeSession(req.cookies.get(AUTH_COOKIE)?.value)) return esignClosed ? closedEsign(req, path) : NextResponse.next();
  if (req.method !== 'GET' || path.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }
  const to = req.nextUrl.clone();
  to.pathname = '/login';
  to.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
  return NextResponse.redirect(to);
}

/** 닫힌 전자계약 실행 경로 — 고객 링크·API는 없는 주소로 답한다. */
function closedEsign(req: NextRequest, path: string) {
  return path.startsWith('/api/')
    ? NextResponse.json({ error: '전자계약은 현재 운영 범위가 아닙니다' }, { status: 404 })
    : new NextResponse('Not Found', { status: 404 });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
