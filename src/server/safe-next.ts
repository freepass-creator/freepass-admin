/**
 * **로그인 뒤 돌아갈 곳** — 우리 안쪽 경로만.
 * ★`//evil.com` 뿐 아니라 `/\evil.com` 도 막는다 — URL 해석은 `\` 를 `/` 로 읽어 남의 주소가 된다.
 *   제어문자도 막는다(탭·줄바꿈은 URL 해석에서 지워져 같은 길이 열린다).
 */
export function safeNextPath(v: unknown): string {
  const s = String(v ?? '');
  if (!s.startsWith('/') || s.startsWith('/login')) return '/';
  if (/[\\\u0000-\u001f\u007f]/.test(s)) return '/';
  const base = 'https://admin.invalid';
  const u = new URL(s, base);
  return u.origin === base ? `${u.pathname}${u.search}${u.hash}` : '/';
}

/** 다른 origin 으로 새는 주소를 한 번 더 막는다 — 쿠키에 담겨 돌아온 값도 믿지 않는다 */
export function sameOriginRedirect(next: unknown, origin: string): URL {
  const u = new URL(safeNextPath(next), origin);
  return u.origin === new URL(origin).origin ? u : new URL('/', origin);
}
