import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '로그인 · freepass admin', robots: { index: false, follow: false } };

/**
 * ★로그인 — 관리자 위 띠 · 메뉴 없이(루트 layout 은 쪽 틀만 — 관리자 틀은 관리자 쪽 layout 에만).
 *   대표 2026-09-18 「어드민 로그인 붙이는 거는 우리 기존 로그인 화면 있지??」 — erp4 app/login(LoginView)의 짜임 그대로:
 *   워드마크 → 「로그인」 · 한 줄 설명 → 이메일 · 비밀번호 → 로그인(주 단추). 관리자 계정만이라 가입 · 재설정은 없다.
 *   하는 일은 기능 쪽 loginAction(규칙 src/server/auth.ts) — 실패 글은 받은 그대로.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const next = Array.isArray(q.next) ? q.next[0] : q.next;
  return <LoginForm next={next ?? ''} />;
}
