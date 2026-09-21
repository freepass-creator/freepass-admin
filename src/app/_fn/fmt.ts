/** 보이는 꼴만 정한다 — 값의 뜻은 도메인이 정한다. ★모르는 값은 「—」 로, 0 으로 꾸미지 않는다. */
export const won = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString('ko-KR')}`;
export const num = (n: number | null | undefined, unit = '') =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('ko-KR')}${unit}`;
export const txt = (s: string | null | undefined) => (s && s.trim() ? s : '—');
export const yes = (b: boolean) => (b ? '●' : '○');
export const when = (ms: number | null | undefined) =>
  !ms ? '—' : new Date(ms + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');

/** searchParams 한 칸 — 배열로 와도 첫 값만. */
export const sp = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** 값 목록 — 많이 쓴 것이 앞. 빈 값은 뺀다. */
export function vocab(values: Iterable<string | null | undefined>): string[] {
  const m = new Map<string, number>();
  for (const v of values) { const t = (v ?? '').trim(); if (t) m.set(t, (m.get(t) ?? 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}
