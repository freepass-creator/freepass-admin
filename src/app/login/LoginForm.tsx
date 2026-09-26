'use client';
/**
 * 로그인 폼 — erp4 LoginView 의 로그인 칸 그대로(이메일 · 비밀번호 · 로그인), 옷은 우리 규격(§14-9: 컨트롤 40 · 주 단추 44 · 라운드 4).
 *   워드마크는 공식 CI의 굵기·색 규칙을 유지한다. 운영 build 안정성을 위해 원격 Google Font 로더에는 의존하지 않는다.
 */
import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  return (
    <main className="lg-main">
      <section className="lg-card">
        <div className="lg-brand">
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
