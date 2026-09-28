/**
 * 관리자 전자계약 목록(/esign)은 독립 업무 페이지로 항상 연다(사용자 확정 2026-09-28).
 * 고객 서명 링크와 발행/승인 API는 별도 운영 기능이므로 `ESIGN_ENABLED=on` 전까지 닫는다.
 */
export const esignEnabled = () => process.env.ESIGN_ENABLED?.trim() === 'on';

export function isEsignRuntimePath(path: string): boolean {
  return path.startsWith('/sign/')
    || path.startsWith('/api/esign/')
    || /^\/api\/intake\/[^/]+\/contract\/?$/.test(path);
}
