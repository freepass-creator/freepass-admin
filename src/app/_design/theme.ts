/**
 * ★관리자 화면 테마 — AI Core «ERP 표준 UI 규격 v1» 의 공식 테마 2종 (대표 2026-09-23)
 *   「1번 테마, 2번 테마 다 저장해서 제대로 규격화 하고 … 프리패스 어드민에 적용」
 *
 * 정본 = ai-core `design/erp-standard/themes/index.json` (default classic · retro).
 *   테마는 색 · 선 · 모서리 · 글꼴 · 그림자만 바꾼다. 자리 · 차례 · 기능 · 크기 기준(18/14/12 · 44)은 그대로다.
 *   사람마다 고른 테마는 쿠키로 기억한다 — 서버가 첫 화면부터 찍어서 깜빡이지 않는다.
 */
export const THEMES = ['classic', 'retro'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'classic';
export const THEME_COOKIE = 'fpa-theme';

export const THEME_LABEL: Record<Theme, string> = {
  classic: '클래식',
  retro: '레트로',
};

/** 쿠키 값은 사람이 고칠 수 있다 — 목록에 있는 이름만 받는다. */
export function themeOf(value: string | undefined | null): Theme {
  return (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : DEFAULT_THEME;
}

/** 테마를 바꾼 뒤 돌아갈 주소 — 이 앱 안의 경로만 받는다(열린 되돌림 방지). */
export function safeBack(value: string | undefined | null): string {
  const v = String(value ?? '');
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/';
}
