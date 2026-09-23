'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

export type Choice = { v: string; label: string; count?: number };

/**
 * 한 줄 조건 — 드롭다운 하나가 주소 칸 하나를 쥔다 (대표 2026-09-23 「검색창 밑에 월 · 구분 · 공급사 · 영업채널 한 줄」).
 *   고르면 바로 그 조건으로 다시 거른다. 칩 줄을 따로 두지 않는다.
 *   reset — 조건이 바뀌면 같이 지울 칸(고른 줄 ic · 묶음 g 처럼 딸린 것).
 */
export function SelectFilter({ name, value, choices, all = '전체', label, reset = [] }: {
  name: string; value: string; choices: Choice[]; all?: string; label: string; reset?: string[];
}) {
  const router = useRouter();
  const path = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <select className="filter-select" aria-label={label} aria-busy={pending || undefined} value={value}
      onChange={(e) => {
        const u = new URLSearchParams(window.location.search);
        if (e.target.value) u.set(name, e.target.value); else u.delete(name);
        for (const k of reset) u.delete(k);
        const s = u.toString();
        startTransition(() => router.replace(s ? `${path}?${s}` : path, { scroll: false }));
      }}>
      <option value="">{all}</option>
      {choices.map((c) => (
        <option key={c.v} value={c.v}>{c.label}{c.count !== undefined ? ` ${c.count}` : ''}</option>
      ))}
    </select>
  );
}
