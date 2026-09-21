/**
 * 주소 칸의 «고른 값» — `?status=즉시출고,출고협의` → ['즉시출고', '출고협의'].
 * ⚠ 서버 화면(workspace)과 조건판(FilterSheet, 클라이언트)이 같이 쓴다 — 클라이언트 파일에 두면
 *   서버가 부를 수 없다(실측: 「Attempted to call 고른값() from the server」 로 쪽이 통째로 죽었다).
 */
export const 고른값 = (v: string | null | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
