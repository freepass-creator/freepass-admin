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

/**
 * 긴 카드 — 규격 §5-3. 한 건 = 가로로 긴 카드 한 장(대표 2026-09-23 「줄 타입은 촌스럽다 … 카드를 기다랗게」 · 「그거 규격으로 다 해놓고」).
 *   ① 누구 · 무슨 차 → ② 어디까지 왔나(steps) → ③ 조건(facts) → ④ 돈. 이름 링크가 카드 전체를 덮는다.
 *   steps 가 없으면(상품) ③ 이 ② 자리까지 넓어진다. 좁은 창 · 폰에서는 칸이 위아래로 쌓인다.
 */
export type Fact = [label: string, value: ReactNode, sub?: ReactNode];
export function RowCard({ href, tone, current, title, badge, plate, car, meta, steps, facts, amount, amountLabel, unit = '원' }: {
  href: string; tone?: Tone; current?: boolean; title: ReactNode; badge?: ReactNode; plate?: ReactNode; car?: ReactNode; meta?: ReactNode;
  /** labels · at: 지금 단계 번호(labels.length 면 다 끝, -1 이면 멈춤) */
  steps?: { labels: string[]; at: number };
  facts: Fact[]; amount?: ReactNode; amountLabel?: string; unit?: string;
}) {
  return (
    <article className={`erp-rowcard${steps ? '' : ' erp-rowcard--no-steps'}`} role="listitem"
      data-tone={tone && tone !== 'neutral' ? tone : undefined} aria-current={current ? 'true' : undefined}>
      <div className="erp-rowcard-id">
        <h3 className="erp-rowcard-title"><Link className="erp-rowcard-link" href={href}>{title}</Link>{badge}</h3>
        {plate || car ? <div className="erp-rowcard-car">{plate ? <b>{plate}</b> : null}{car}</div> : null}
        {meta ? <div className="erp-rowcard-meta">{meta}</div> : null}
      </div>
      {steps ? (
        <ol className="erp-rowcard-steps" aria-label="진행">
          {steps.labels.map((l, i) => (
            <li key={l} data-state={steps.at >= 0 && i < steps.at ? 'done' : undefined} aria-current={i === steps.at ? 'step' : undefined}><i />{l}</li>
          ))}
        </ol>
      ) : null}
      <dl className="erp-rowcard-facts">
        {facts.map(([k, v, sub]) => <div key={k}><dt>{k}</dt><dd>{v}{sub ? <small>{sub}</small> : null}</dd></div>)}
      </dl>
      {amount !== undefined ? <div className="erp-rowcard-amount"><strong>{amount}<small>{unit}</small></strong>{amountLabel ? <span>{amountLabel}</span> : null}</div> : null}
      <svg className="erp-rowcard-go" viewBox="0 0 24 24" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
    </article>
  );
}

/** 긴 카드 목록 — 그리드 자리(data-region="grid") */
export function RowCards({ children, label }: { children: ReactNode; label: string }) {
  return <div className="erp-rowcards" data-region="grid" role="list" aria-label={label}>{children}</div>;
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

export type Facet = { key: string; title: string; options: { value: string; label?: string; count?: number }[] };

/**
 * ⑥ 조회 — 검색창 하나 + 상세 필터 하나 (규격 §5-1 «미니멀»).
 *   조건은 상세 필터 안의 건수 칩으로 고르고(주소 한 칸씩), 고른 조건은 검색창 옆 칩(×)으로 보인다.
 *   드롭다운은 분류가 꼭 필요한 화면에서만(dropdown) — 고르면 바로 조회.
 */
export function SearchBar({ base, q, name = 'q', placeholder, facets = [], dropdown, keep = [], aside }: {
  base: string; q: Record<string, string | string[] | undefined>; name?: string; placeholder: string;
  facets?: Facet[]; dropdown?: ReactNode; keep?: string[];
  /** 상태 탭 — 검색 줄 오른쪽. 툴바 줄은 일괄 작업이 있을 때만 따로 둔다(규격 §5-1) */
  aside?: ReactNode;
}) {
  const val = (k: string) => { const v = q[k]; return (Array.isArray(v) ? v[0] : v) ?? ''; };
  const active = facets.flatMap((f) => (val(f.key) ? [{ f, v: val(f.key) }] : []));
  const hidden = [...keep, ...facets.map((f) => f.key)].filter((k) => k !== name && val(k));
  return (
    <form className="erp-searchbar" data-region="filter" role="search" action={base}>
      {dropdown}
      {hidden.map((k) => <input key={k} type="hidden" name={k} value={val(k)} />)}
      <label className="erp-search">
        <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input name={name} defaultValue={val(name)} placeholder={placeholder} aria-label={placeholder} />
      </label>
      {facets.length ? (
        <details className="erp-filter-more">
          <summary className="erp-btn">상세 필터{active.length ? <> <b>{active.length}</b></> : null}</summary>
          <div className="erp-filter-panel">
            {facets.map((f) => (
              <div className="erp-facet" key={f.key}>
                <p className="erp-facet-title">{f.title}</p>
                <div className="erp-facet-opts">
                  {f.options.map((o) => {
                    const on = val(f.key) === o.value;
                    return (
                      <Link key={o.value} className="erp-facet-opt" aria-pressed={on}
                        href={hrefWith(base, q, { [f.key]: on ? null : o.value, page: null })}>
                        {o.label ?? o.value}{o.count !== undefined ? <small>{o.count}</small> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="erp-filter-panel-foot">
              <Link className="erp-btn erp-btn--ghost" href={hrefWith(base, q, Object.fromEntries([...facets.map((f) => [f.key, null]), ['page', null]]))}>조건 모두 지우기</Link>
            </div>
          </div>
        </details>
      ) : null}
      {active.map(({ f, v }) => (
        <Link key={f.key} className="erp-chip" href={hrefWith(base, q, { [f.key]: null, page: null })}>
          {f.title}: {f.options.find((o) => o.value === v)?.label ?? v} ×
        </Link>
      ))}
      {aside ? <><span className="erp-toolbar-spacer" /><div data-region="grid-toolbar">{aside}</div></> : null}
    </form>
  );
}
