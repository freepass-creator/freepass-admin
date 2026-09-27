/**
 * **어드민 로그인 — 프리패스 공용 신원 계약을 입는다.**
 *
 * ★대표 2026-09-27 「로그인화면 갖고오자」
 *   ⇒ 화면은 프리패스 데이터의 공용 로그인(`src/app/login/shared/*` — 그쪽 정본을 «고치지 않고» 옮긴 것),
 *     계정·승인·권한은 프리패스 데이터가 정본(`src/server/identity.ts`).
 *   ⇒ 이전 순서(freepass-data `docs/SHARED-LOGIN-DESIGN.md` §5, `IDENTITY-AND-ACCESS.md` §5)의 2번이
 *     이 앱이며, 그 항목이 「구글 OAuth 와 허용목록을 걷어내고 붙인다 · APPROVAL」이다. 그대로 했다.
 * ★대표 2026-09-27 「프리패스 ERP3는 이제 안 쓰는 건데」 — erp4(freepasserp3) 문은 앞서 걷어냈다.
 *
 * ── 세션
 *   Firebase 가 발급한 세션 쿠키다. 우리가 만든 토큰이 아니다(계약 §2).
 *   ★proxy 는 «쿠키가 있는지»만 본다 — 모든 요청 앞에서 도는 자리에 firebase-admin 을 싣지 않는다.
 *     진짜 검증(서명 · 취소 · 승인 · grant)은 require-admin.ts 가 쪽과 서버 액션 앞에서 한다.
 *     그래서 가짜 쿠키는 proxy 를 지나가더라도 «아무것도 못 보고 못 고친다».
 *
 * ── 켜고 끄기
 *   배포(NODE_ENV=production)에서는 «늘 켜짐» — 끌 수 없다(끄는 칸을 두면 언젠가 꺼진 채 나간다).
 *   개발에서는 ADMIN_AUTH=on 일 때만 — 화면을 만지는 동안 매번 로그인하지 않게.
 */
export const AUTH_COOKIE = 'fpa_session';

export const authEnforced = () =>
  process.env.NODE_ENV === 'production' || process.env.ADMIN_AUTH?.trim() === 'on';

export interface AdminUser { uid: string; name: string; role: 'admin'; email?: string }

/**
 * proxy 전용 — 쿠키가 «있는지»만. 이것으로 사람을 들이지 않는다.
 * Firebase 세션 쿠키는 JWT 꼴이라 점 둘로 나뉜다. 꼴이 아니면 볼 것도 없다.
 */
export function looksLikeSession(cookie: string | undefined): boolean {
  return !!cookie && cookie.split('.').length === 3 && cookie.length > 32;
}

/** 로그인 없이 열리는 길 — 청구 링크 · 사진 · 글꼴 · 로그인 자체 · Next 내부 */
export function isPublicPath(path: string): boolean {
  return path === '/login' || path.startsWith('/api/session') || path.startsWith('/c/') || path.startsWith('/api/img')
    || path.startsWith('/sign/') || path.startsWith('/api/esign/public/')
    /* ★/fonts 는 통째로 연다 — 확장자만 보면 글꼴 CSS(.css)가 빠져 로그인으로 튕기고, 로그인 화면이
       제 글꼴 없이 선다(실측 2026-09-27). 이 아래에는 OFL 글꼴과 그 라이선스 글뿐이다. */
    || path.startsWith('/fonts/')
    || path.startsWith('/_next/') || path === '/favicon.ico' || /\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(path);
}
