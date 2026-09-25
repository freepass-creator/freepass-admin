const BASE = 'https://freepass-admin.invalid';

/**
 * 로그인 뒤 돌아갈 곳 — «이 사이트 안의 경로»만 통과시킨다.
 * ★문자열 앞머리만 보면 안 된다: 브라우저는 `/\evil.com` 을 `//evil.com`(다른 사이트)으로 읽고,
 *   탭·개행은 지운 뒤 읽는다. 그래서 실제로 URL 로 풀어 본 뒤 같은 출처인지 확인한다.
 */
export function safeNextPath(value: unknown): string {
  const raw = String(value ?? '');
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  if (/[\u0000-\u001f\u007f]/.test(raw)) return '/';
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return '/';
  }
  if (url.origin !== BASE) return '/';
  if (url.pathname.startsWith('/login')) return '/';
  return url.pathname + url.search + url.hash;
}
