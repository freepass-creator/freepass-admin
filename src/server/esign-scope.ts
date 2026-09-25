/**
 * **전자계약 — 운영 개시 범위 밖** (사용자 확정 2026-09-25 「전자계약은 운영개시에 빼고」).
 * ★코드는 그대로 두고 문만 닫는다. `ESIGN_ENABLED=on` 일 때만 관리자 화면 · 고객 서명 링크 · 전자계약 API 가 열린다.
 *   관리자 발행/승인/반려 화면이 아직 없어 열어 두면 고객 제출이 「검토대기」에서 멈춘다(docs/LAUNCH-READINESS-2026-09-25.md).
 */
export const esignEnabled = () => process.env.ESIGN_ENABLED?.trim() === 'on';

export function isEsignPath(path: string): boolean {
  return path === '/esign' || path.startsWith('/esign/')
    || path.startsWith('/sign/')
    || path.startsWith('/api/esign/')
    || /^\/api\/intake\/[^/]+\/contract\/?$/.test(path);
}
