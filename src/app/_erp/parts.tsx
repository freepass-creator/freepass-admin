/**
 * 규격 부품 — AI Core «ERP 표준 UI 규격 v1» 의 마크업을 그대로 찍는 작은 조각들 (DEC-2026-09-23-01)
 *   클래스 이름 · 자리 · 차례는 ai-core `design/erp-standard/platform/*.html` 과 같다. 모양은 _erp/erp-standard.css.
 *   여기서 새 모양을 짓지 않는다 — 규격에 없는 것이 필요하면 ai-core 규격에 먼저 넣는다.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export type Tone = 'ok' | 'info' | 'warn' | 'err' | 'neutral';

/** 화면 한 장 — actual route의 responsive composition 단위. data-region은 규격 골격 이름. */
export function Screen({ name, children, footer }: { name: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="erp-screen erp-std" data-screen={name}>
      <div className="erp-content">{children}</div>
      {footer}
    </div>
  );
}

/**
 * 패널 — 규격 §5-4. 판 셋(목록 | 상세내용 | 목록)을 나란히 조립하는 자족 카드. `compact` 면 카드가
 * 좁은 폭에 맞춰 두 줄로 접힌다(erp-panel--compact — SearchBar · RowCards · RowCard 는 이 클래스가
 * 부모에 있으면 저절로 좁은 모양으로 바뀐다, 부품 쪽에서 따로 안 챙겨도 된다). `wide` 는 판이 셋일
 * 필요 없는 화면(목록 + 상세 둘뿐)에서 목록 판을 다른 목록 판 두 개 폭으로 넓힌다(erp-panel--wide) —
 * compact 와 같이 쓰면 좁은 카드가 두 칸 그리드로 깐다(대표 2026-09-24 「패널 두 개를 합쳐서 … 목록
 * 패널이 1 곱하기 2짜리가 들어가」).
 */
export function Panel({ compact, wide, flip, children }: { compact?: boolean; wide?: boolean; flip?: boolean; children: ReactNode }) {
  return <section className={`erp-panel${compact ? ' erp-panel--compact' : ''}${wide ? ' erp-panel--wide' : ''}${flip ? ' erp-panel--flip' : ''}`}>{children}</section>;
}

/** 패널 머리 — 왼쪽 이름표 칩 + 제목, 오른쪽 칩(§5-4 「전체 N건」/「고른 <대상>」). */
export function PanelHead({ kind, title, count }: { kind: string; title: ReactNode; count: ReactNode }) {
  return (
    <div className="erp-panel-head">
      <span className="erp-panel-kind">{kind}</span>
      <h2 title={typeof title === 'string' || typeof title === 'number' ? String(title) : undefined}>{title}</h2>
      <span className="erp-panel-count" title={typeof count === 'string' || typeof count === 'number' ? String(count) : undefined}>{count}</span>
    </div>
  );
}

/** 패널 몸 — 안에서 스크롤 */
export function PanelBody({ children }: { children: ReactNode }) {
  return <div className="erp-panel-body">{children}</div>;
}

export function PanelState({ kind = 'empty', title, children }: {
  kind?: 'empty' | 'loading' | 'error' | 'readonly';
  title: ReactNode;
  children?: ReactNode;
}) {
  const role = kind === 'error' ? 'alert' : 'status';
  return (
    <div className={`erp-panel-state erp-state-${kind}`} role={role}
      aria-live={kind === 'error' ? 'assertive' : 'polite'} aria-busy={kind === 'loading' ? 'true' : undefined}
      data-ui-state={kind}>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

/** 패널 하단 고정 — 스크롤과 무관하게 바닥에 붙는 버튼 줄 */
export function PanelFoot({ children, balance = 'primary' }: {
  children: ReactNode;
  /** primary: 2개 3:7 / 3개 3:3:4. equal: 동급 2개 5:5 */
  balance?: 'primary' | 'equal';
}) {
  return <div className="erp-panel-foot" data-action-balance={balance}>{children}</div>;
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

/**
 * 타일 — 규격 §5-4/§5-6. 테두리 없이 그림자로만 뜨는 낱장 카드 — 핵심 정보를 2행으로 보여준다
 *   (메인 행: 이름 + 강조 값, 보조 행: 라벨 + 강조 보조값). href 를 주면 고르는 타일(A. 누르는 카드,
 *   aria-pressed)이 되고, 안 주면 그냥 읽는 타일(B. 설명하는 카드)이 된다. §4 `erp-card`(테두리 있는
 *   큰 구획 카드)와는 다른 부품이다 — 헷갈리지 않게 이름을 다르게 뒀다(erp.css 참고).
 */
export function Tile({ href, pressed, lede, figure, note, noteAccent }: {
  href?: string; pressed?: boolean; lede: ReactNode; figure: ReactNode; note?: ReactNode; noteAccent?: ReactNode;
}) {
  const cls = `erp-tile${href ? ' erp-tile--pressable' : ''}`;
  const body = <>
    <div className="erp-tile-row"><b>{lede}</b><strong>{figure}</strong></div>
    {note !== undefined || noteAccent !== undefined ? (
      <div className="erp-tile-row"><span>{note}</span><span className="erp-tile-note--accent">{noteAccent}</span></div>
    ) : null}
  </>;
  return href
    ? <Link className={cls} aria-pressed={pressed} href={href}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

/** 타일 목록 — 카드 사이 간격(§5-4 표) */
export function TileGroup({ children }: { children: ReactNode }) {
  return <div className="erp-tile-group">{children}</div>;
}

/**
 * 긴 카드 — 규격 §5-3. 한 건 = 가로로 긴 카드 한 장(대표 2026-09-23 「줄 타입은 촌스럽다 … 카드를 기다랗게」 · 「그거 규격으로 다 해놓고」).
 *   ① 누구 · 무슨 차 → ② 어디까지 왔나(steps) → ③ 조건(facts) → ④ 돈. 이름 링크가 카드 전체를 덮는다.
 *   steps 가 없으면(상품) ③ 이 ② 자리까지 넓어진다. 좁은 창 · 폰에서는 칸이 위아래로 쌓인다.
 */
export type Fact = [label: string, value: ReactNode, sub?: ReactNode];
export function RowCard({ href, tone, current, thumb, thumbStatus, title, badge, subId, sub, meta, steps, facts, amount, amountLabel, unit = '원' }: {
  href: string; tone?: Tone; current?: boolean; title: ReactNode; badge?: ReactNode; subId?: ReactNode; sub?: ReactNode; meta?: ReactNode;
  /** 목록 visual tile — 64×64. 상품은 사진/차량 아이콘, 일반 목록은 상태 아이콘 + 짧은 글자.
   *  본문 Main/Key/Support 64px와 같은 높이로 맞춘다. */
  thumb?: ReactNode; thumbStatus?: boolean;
  /** labels · at: 지금 단계 번호(labels.length 면 다 끝, -1 이면 멈춤) */
  steps?: { labels: string[]; at: number };
  facts: Fact[]; amount?: ReactNode; amountLabel?: string; unit?: string;
}) {
  return (
    <article className={`erp-rowcard${steps ? '' : ' erp-rowcard--no-steps'}`} role="listitem"
      data-tone={tone && tone !== 'neutral' ? tone : undefined}
      data-thumb-status={thumbStatus ? 'true' : undefined}
      aria-current={current ? 'true' : undefined}>
      {thumb ? <div className={`erp-rowcard-thumb${thumbStatus ? ' erp-rowcard-thumb--status' : ''}`}>{thumb}</div> : null}
      <div className="erp-rowcard-id">
        <h3 className="erp-rowcard-title" data-line-role="main"><Link className="erp-rowcard-link" href={href} aria-current={current ? 'true' : undefined}
          title={typeof title === 'string' || typeof title === 'number' ? String(title) : undefined}>{title}</Link>{thumbStatus ? null : badge}</h3>
        {subId || sub ? <div className="erp-rowcard-sub" data-line-role="key">{subId ? <b>{subId}</b> : null}{sub}</div> : null}
        {meta ? <div className="erp-rowcard-meta" data-line-role="support">{meta}</div> : null}
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

/**
 * 퀵 필터 — 좁은 패널(compact) 전용, 검색창 바로 밑 독립 버튼 줄(§5-4 — erp-seg 아니라 erp-facet-opt).
 * 분류 드롭다운(erp-dd, 정산·실적의 달 고르기)도 «고르는 즉시 목록이 바뀐다»는 점에서 퀵 필터 한
 * 줄의 식구다(대표 2026-09-24 「그 드랍다운은 퀵필터라고 생각을 하고 퀵필터 라인에 있어야 돼」) —
 * 검색창 줄이 아니라 여기, 퀵 필터 알약들 바로 앞에 선다.
 */
export function QuickFilter({ label, items, dropdown }: {
  label: string; items: { key: string; label: ReactNode; href: string; on: boolean }[]; dropdown?: ReactNode;
}) {
  return (
    <div className="erp-toolbar" data-region="grid-toolbar">
      {dropdown}
      <div className="erp-facet-opts" role="group" aria-label={label}>
        {items.map((it) => <Link key={it.key} className="erp-facet-opt" href={it.href} aria-pressed={it.on}>{it.label}</Link>)}
      </div>
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
export const manWon = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? `${Math.round(n / 10000).toLocaleString('ko-KR')}만` : '—');

export type Facet = { key: string; title: string; options: { value: string; label?: string; count?: number }[] };

/**
 * ⑥ 조회 — 검색창 하나 + 필터 하나 (규격 §5-1 «미니멀»).
 *   조건은 필터 안의 건수 칩으로 고르고(주소 한 칸씩), 고른 조건은 검색창 옆 칩(×)으로 보인다.
 *   드롭다운은 분류가 꼭 필요한 화면에서만(dropdown) — 고르면 바로 조회.
 */
export function SearchBar({ base, q, name = 'q', placeholder, facets = [], filter, dropdown, keep = [], aside }: {
  base: string; q: Record<string, string | string[] | undefined>; name?: string; placeholder: string;
  facets?: Facet[]; dropdown?: ReactNode; keep?: string[];
  /** 필터 — 화이트라벨·레트로의 두 칸 조건판(FilterSheet). 주면 이걸 쓰고, facets 의 단일값 칩 필터는 안 그린다
   *  (검색창 옆에는 늘 필터 하나 — 규격 §5-1, 대표 2026-09-24 「검색창 옆에는 필터 버튼이 있다」). */
  filter?: ReactNode;
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
      {filter ?? (facets.length ? (
        <details className="erp-filter-more">
          <summary className="erp-btn">필터{active.length ? <> <b>{active.length}</b></> : null}</summary>
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
      ) : null)}
      {active.map(({ f, v }) => (
        <Link key={f.key} className="erp-chip" href={hrefWith(base, q, { [f.key]: null, page: null })}>
          {f.title}: {f.options.find((o) => o.value === v)?.label ?? v} ×
        </Link>
      ))}
      {aside ? <><span className="erp-toolbar-spacer" /><div data-region="grid-toolbar">{aside}</div></> : null}
    </form>
  );
}
