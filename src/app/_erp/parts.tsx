/**
 * 규격 부품 — AI Core «ERP 표준 UI 규격 v1» 의 마크업을 그대로 찍는 작은 조각들 (DEC-2026-09-23-01)
 *   클래스 이름 · 자리 · 차례는 ai-core `design/erp-standard/platform/*.html` 과 같다. 모양은 _erp/erp-standard.css.
 *   여기서 새 모양을 짓지 않는다 — 규격에 없는 것이 필요하면 ai-core 규격에 먼저 넣는다.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export type Tone = 'ok' | 'info' | 'warn' | 'err' | 'neutral';

/** 화면 한 장 — PC 에서만 선다(폰은 기존 판). data-region 은 규격 골격 이름. */
export function Screen({ name, children, footer }: { name: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="erp-screen erp-std" data-screen={name}>
      <div className="erp-content">{children}</div>
      {footer}
    </div>
  );
}

/** ④ 페이지 헤더 — 경로 · 제목(+뱃지) · 설명 · 액션(Primary 는 맨 오른쪽 하나) */
export function PageHeader({ crumb, title, badge, desc, actions }: {
  crumb: string[]; title: ReactNode; badge?: ReactNode; desc?: ReactNode; actions?: ReactNode;
}) {
  return (
    <section data-region="page-header">
      <div className="erp-crumb">
        {crumb.slice(0, -1).map((c) => <span key={c}>{c} › </span>)}
        <span aria-current="page">{crumb[crumb.length - 1]}</span>
      </div>
      <div className="erp-page-header">
        <div>
          <h1 className="erp-page-title">{title}{badge ? <> {badge}</> : null}</h1>
          {desc ? <p className="erp-page-desc">{desc}</p> : null}
        </div>
        {actions ? <div className="erp-actions">{actions}</div> : null}
      </div>
    </section>
  );
}

export type Kpi = { label: string; side?: string; value: string; unit?: string; delta?: ReactNode; alert?: boolean };
/** ⑤ 요약 KPI — 4열 */
export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <section className="erp-kpis" data-region="kpi" aria-label="요약">
      {items.map((k) => (
        <div className="erp-kpi" key={k.label}>
          <div className="erp-kpi-label">{k.label} <span>{k.side}</span></div>
          <div className={`erp-kpi-value${k.alert ? ' erp-kpi-value--alert' : ''}`}>{k.value}{k.unit ? <small>{k.unit}</small> : null}</div>
          <div className="erp-kpi-delta">{k.delta ?? ' '}</div>
        </div>
      ))}
    </section>
  );
}

/** 상태 뱃지 — 색 + 점 + 글자 */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`erp-badge erp-badge--${tone}`}>{children}</span>;
}

/** 진행 단계 — current: 지금 단계 번호(-1 이면 건수 현황 — 상태 없이 숫자만) */
export function Steps({ items, current }: { items: { label: string; count?: ReactNode }[]; current: number }) {
  return (
    <ol className="erp-steps">
      {items.map((s, i) => {
        const done = current >= 0 && i < current;
        const now = current >= 0 && i === current;
        return (
          <li key={s.label} data-state={done ? 'done' : undefined} aria-current={now ? 'step' : undefined}>
            <span className="erp-step-dot">{done ? '✓' : i + 1}</span>{s.label}
            {s.count !== undefined ? <span className="erp-step-count">{s.count}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** 카드 머리 */
export function CardHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="erp-card-head">
      <h2 className="erp-card-title">{title}{sub ? <small>{sub}</small> : null}</h2>
      {right}
    </div>
  );
}

/** 값 묶음 */
export function Props({ pairs }: { pairs: [string, ReactNode][] }) {
  return <dl className="erp-props">{pairs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

/** 세그먼트(상태 탭) — 링크로 고른다 */
export function Seg({ label, items }: { label: string; items: { key: string; label: ReactNode; href: string; on: boolean }[] }) {
  return (
    <div className="erp-seg" role="group" aria-label={label}>
      {items.map((it) => <Link key={it.key} href={it.href} aria-pressed={it.on}>{it.label}</Link>)}
    </div>
  );
}

/** 필드 — 라벨 위 · 필수 * */
export function Field({ label, req, children }: { label: string; req?: boolean; children: ReactNode }) {
  return (
    <label className="erp-field">
      <span className="erp-label">{label}{req ? <> <em className="erp-req">*</em></> : null}</span>
      {children}
    </label>
  );
}

export function Select({ name, value, options, all = '전체' }: { name: string; value: string; options: string[]; all?: string }) {
  return (
    <select className="erp-input" name={name} defaultValue={value}>
      <option value="">{all}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** 주소 한 칸만 바꾼 새 주소 */
export function hrefWith(base: string, q: Record<string, string | string[] | undefined>, patch: Record<string, string | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) { const s = Array.isArray(v) ? v[0] : v; if (s) u.set(k, s); }
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === '') u.delete(k); else u.set(k, v); }
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

export const won0 = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('ko-KR') : '—');
export const man = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? `${Math.round(n / 1000).toLocaleString('ko-KR')}` : '—');
