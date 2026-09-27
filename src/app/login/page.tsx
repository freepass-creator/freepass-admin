import { googleLoginReady, workspaceDomain } from '../../server/google-login';
import { safeNextPath } from '../../server/safe-next';

export const dynamic = 'force-dynamic';
export const metadata = { title: '로그인 · freepass admin', robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * ★로그인 — 관리자 위 띠 · 메뉴 없이(루트 layout 은 쪽 틀만 — 관리자 틀은 관리자 쪽 layout 에만).
 *   대표 2026-09-27 「프리패스 ERP3는 이제 안 쓰는 건데」 — erp4 이메일·비밀번호 칸을 걷어내고
 *   워크스페이스 구글 문 하나만 둔다. 짜임은 그대로: 워드마크 → 「로그인」 · 한 줄 설명 → 주 단추.
 *   ★설정이 없으면 «다른 문을 내주지 않는다» — 까닭만 적고 닫는다.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const next = safeNextPath(one(q.next));
  const error = one(q.error);
  const domain = workspaceDomain();
  return (
    <main className="lg-main">
      <section className="lg-card">
        <div className="lg-brand">
          <span><b>freepass</b><i>admin</i></span>
        </div>
        <header>
          <h1>로그인</h1>
          <p>{domain} 구글 계정으로 들어옵니다.</p>
        </header>
        {error && <p className="lg-err">{error}</p>}
        {googleLoginReady()
          ? <a className="lg-go" href={`/login/google?next=${encodeURIComponent(next)}`}>구글 계정으로 로그인</a>
          : <p className="lg-err">구글 로그인 설정이 아직 없습니다 — 관리자에게 알려 주세요</p>}
        <p className="lg-foot">{domain} 구성원만 들어올 수 있습니다.</p>
      </section>
    </main>
  );
}
