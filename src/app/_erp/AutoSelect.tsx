'use client';
/** 분류 드롭다운 — 고르면 바로 조회한다(규격 erp-dd). 계약 · 정산 · 실적 조회에서만 1~2개. */
export function AutoSelect({ name, value, label, options }: { name: string; value: string; label: string; options: [string, string][] }) {
  return (
    <select className="erp-input erp-dd" name={name} defaultValue={value} aria-label={label}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
