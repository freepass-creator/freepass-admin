/**
 * **어드민 로그인 — Google Workspace(teamjpk.com) 문 하나뿐.**
 *
 * ★대표 2026-09-27 「프리패스 ERP3는 이제 안 쓰는 건데 그걸 또 갖고 오면 어떻게 하냐」
 *   ⇒ 2026-09-18 의 「일단 프리패스erp4 계정을 같이 쓰자」는 «뒤집혔다». erp4(freepasserp3) Auth 로 받던
 *     이메일·비밀번호 문과 그 경로(signIn · signOut · adminOf · ADMIN_EMAILS · ADMIN_UIDS)를 걷어냈다.
 *   ⇒ 운영 정문은 src/server/google-login.ts 하나다 — 구글이 서명한 hd=teamjpk.com 표시가 있을 때만 연다.
 *   ★폐기한 ERP3 에는 로그인도 데이터도 붙이지 않는다. 원장·상품 «데이터» 는 그대로 ERP5(freepasserp5).
 *
 * ── 세션
 *   `g1.<본문>.<서명>` — HMAC-SHA256(SESSION_SECRET) · 5일 · httpOnly · secure · sameSite=lax.
 *   요청마다 proxy.ts 가, 서버 액션은 require-admin.ts 가 «다시» 본다.
 *
 * ── 켜고 끄기
 *   배포(NODE_ENV=production)에서는 «늘 켜짐» — 끌 수 없다(끄는 칸을 두면 언젠가 꺼진 채 나간다).
 *   개발에서는 ADMIN_AUTH=on 일 때만 — 화면을 만지는 동안 매번 로그인하지 않게.
 */
import { verifyGoogleSession } from './google-login';

export const AUTH_COOKIE = 'fpa_session';

export const authEnforced = () =>
  process.env.NODE_ENV === 'production' || process.env.ADMIN_AUTH?.trim() === 'on';

export interface AdminUser { uid: string; name: string; role: 'admin'; email?: string }

/** 쿠키 → 관리자. ★구글 워크스페이스 세션(g1.…)만 연다 — 다른 꼴은 전부 닫는다 */
export async function verifySession(cookie: string | undefined): Promise<AdminUser | null> {
  if (!cookie?.startsWith('g1.')) return null;
  try {
    const g = verifyGoogleSession(cookie);
    return g ? { uid: g.uid, name: g.name, role: 'admin', email: g.email } : null;
  } catch { return null; }
}

/** 로그인 없이 열리는 길 — 청구 링크 · 사진 · 글꼴 · 로그인 자체 · Next 내부 */
export function isPublicPath(path: string): boolean {
  return path === '/login' || path.startsWith('/login/google') || path.startsWith('/c/') || path.startsWith('/api/img')
    || path.startsWith('/sign/') || path.startsWith('/api/esign/public/')
    /* ★/fonts 는 통째로 연다 — 확장자만 보면 글꼴 CSS(.css)가 빠져 로그인으로 튕기고, 로그인 화면이
       제 글꼴 없이 선다(실측 2026-09-27). 이 아래에는 OFL 글꼴과 그 라이선스 글뿐이다. */
    || path.startsWith('/fonts/')
    || path.startsWith('/_next/') || path === '/favicon.ico' || /\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(path);
}
