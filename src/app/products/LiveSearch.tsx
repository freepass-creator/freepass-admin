'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

/**
 * 바로 거르는 검색칸 — 한 글자부터 반응한다(대표 2026-09-22 「손오공이라고 치면 한 글자부터 · 타이핑 하나부터」).
 *   치는 대로 0.15초 뒤 주소 칸(name)을 바꿔 판이 다시 거른다 — 한글 조합 중(ㅅ→소→손)에도 따라간다.
 *   ★거름은 서버가 한다(첫 화면과 같은 함수) — 여기는 «주소만» 바꾼다. Enter = 바로 반영, ✕ = 지우기.
 *   reset — 검색이 바뀌면 같이 지울 주소 칸(예: 고른 접수 ic).
 */
export function LiveSearch({ name, defaultValue, placeholder, label, reset = [] }: {
  name: string; defaultValue: string; placeholder: string; label: string; reset?: string[];
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [v, setV] = useState(defaultValue);
  const [pending, startTransition] = useTransition();
  const 기다림 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const 칸 = useRef<HTMLInputElement>(null);

  /* 밖에서 주소가 바뀌면(모두 지우기 · 뒤로) 칸도 따라간다 — 치는 중이면 건드리지 않는다 */
  const 주소값 = params.get(name) ?? '';
  useEffect(() => {
    if (document.activeElement !== 칸.current) setV(주소값);
  }, [주소값]);

  const 보내기 = (next: string) => {
    if (기다림.current) clearTimeout(기다림.current);
    const u = new URLSearchParams(window.location.search);
    if (next.trim()) u.set(name, next); else u.delete(name);
    for (const k of reset) u.delete(k);
    const s = u.toString();
    startTransition(() => router.replace(s ? `${path}?${s}` : path, { scroll: false }));
  };
  const 치기 = (next: string) => {
    setV(next);
    if (기다림.current) clearTimeout(기다림.current);
    기다림.current = setTimeout(() => 보내기(next), 150);
  };
  useEffect(() => () => { if (기다림.current) clearTimeout(기다림.current); }, []);

  return (
    <>
      <svg viewBox="0 0 24 24" aria-hidden="true" className={pending ? 'busy' : undefined}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
      <input ref={칸} name={name} value={v} aria-label={label} placeholder={placeholder} autoComplete="off" enterKeyHint="search"
        aria-busy={pending || undefined}
        onChange={(e) => 치기(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); 보내기(v); } if (e.key === 'Escape' && v) { e.preventDefault(); 치기(''); } }} />
      {v && (
        <button type="button" className="search-clear" aria-label="검색어 지우기" onClick={() => { setV(''); 보내기(''); 칸.current?.focus(); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      )}
    </>
  );
}
