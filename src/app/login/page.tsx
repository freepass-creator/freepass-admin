import { LoginScreen } from './LoginScreen';
import { webConfig } from '../../server/identity';
import { safeNextPath } from '../../server/safe-next';

export const dynamic = 'force-dynamic';
export const metadata = { title: '로그인 · freepass admin', robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * ★로그인 — 관리자 위 띠 · 메뉴 없이(루트 layout 은 쪽 틀만 — 관리자 틀은 관리자 쪽 layout 에만).
 *   대표 2026-09-27 「로그인화면 갖고오자」 — 프리패스 공용 로그인 화면을 그대로 입는다.
 *   Firebase 웹 설정은 비밀이 아니다(공개 배포물에 실린다). 그래서 쪽이 그대로 넘긴다 —
 *   설정만 받으러 한 번 더 왕복하지 않는다.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  return <LoginScreen config={webConfig()} next={safeNextPath(one(q.next))} />;
}
