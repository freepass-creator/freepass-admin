'use client';
/**
 * 로그인 폼 — erp4 LoginView 의 로그인 칸 그대로(이메일 · 비밀번호 · 로그인), 옷은 우리 규격(§14-9: 컨트롤 40 · 주 단추 44 · 라운드 4).
 *   워드마크는 CI 규격(Exo 2 · 「freepass」 600 + 「admin」 300 · 남색 네모 + 흰 체크 — 흰 바탕 위라 원본 색).
 */
import { useActionState } from 'react';
import { Exo_2 } from 'next/font/google';
import { loginAction, type LoginState } from './actions';

const 레터링 = Exo_2({ weight: ['300', '600'], subsets: ['latin'], display: 'swap' });

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  return (
    <main className="lg-main">
      <section className="lg-card">
        <div className={`lg-brand ${레터링.className}`}>
          <svg viewBox="0 0 512 512" aria-hidden width="28" height="28">
            <rect width="512" height="512" rx="96" fill="#1B2A4A" />
            <path d="M128 264 l80 80 L384 168" fill="none" stroke="#ffffff" strokeWidth={52} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span><b>freepass</b><i>admin</i></span>
        </div>
        <header>
          <h1>로그인</h1>
          <p>이메일과 비밀번호를 입력해주세요.</p>
        </header>
        <form action={action}>
          <input type="hidden" name="next" value={next} />
          <label>이메일<input name="email" type="email" autoComplete="username" placeholder="name@company.com" required /></label>
          <label>비밀번호<input name="password" type="password" autoComplete="current-password" placeholder="비밀번호 입력" required /></label>
          {state?.error && <p className="lg-err">{state.error}</p>}
          <button type="submit" disabled={pending}>{pending ? '확인 중…' : '로그인'}</button>
        </form>
        <p className="lg-foot">관리자 계정만 들어올 수 있습니다.</p>
      </section>
    </main>
  );
}
