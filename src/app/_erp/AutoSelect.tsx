'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * 분류 드롭다운 — 고르면 바로 조회한다(규격 erp-dd). 계약 · 정산 · 실적 조회에서만 1~2개, 퀵 필터
 * 줄에 선다(대표 2026-09-24 「그 드랍다운은 퀵필터라고 생각을 하고 퀵필터 라인에 있어야 돼」) — 검색
 * 폼(erp-searchbar) 안이 아니라 QuickFilter(erp-toolbar, 폼이 아니다) 안에 놓일 수도 있어, 감싸는
 * <form> 에 기대지 않고 스스로 주소를 바꾼다(FilterSheet 와 같은 결).
 */
export function AutoSelect({ name, value, label, options }: { name: string; value: string; label: string; options: [string, string][] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <select className="erp-input erp-dd" name={name} defaultValue={value} aria-label={label}
      onChange={(e) => {
        const u = new URLSearchParams(params.toString());
        if (e.target.value) u.set(name, e.target.value); else u.delete(name);
        u.delete('page');
        router.replace(`${path}?${u}`, { scroll: false });
      }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
