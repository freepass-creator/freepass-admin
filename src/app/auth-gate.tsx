import type { AccessErrorCode } from '@/server/auth/errors';

export function AuthGate({ code, surface }: { code: AccessErrorCode; surface: 'ADMIN' | 'SALES' | 'STAFF' }) {
  const message = code === 'AUTH_NOT_CONFIGURED'
    ? '새 Firebase 프로젝트 연결이 아직 확정되지 않았습니다.'
    : code === 'ROLE_NOT_ALLOWED'
      ? '이 계정에는 해당 화면 권한이 없습니다.'
      : code === 'ACCOUNT_DISABLED'
        ? '비활성화된 계정입니다.'
        : '로그인이 필요합니다.';

  return <main className="auth-gate">
    <section>
      <span className="brand-mark">FP</span>
      <p>{surface}</p>
      <h1>{message}</h1>
      <small>기존 ERP 인증은 사용하지 않으며, 신규 인증 연결 전에는 접근을 허용하지 않습니다.</small>
    </section>
  </main>;
}
