'use client';
/**
 * ★★★**세부검색 = 화이트라벨 · 레트로의 «두 칸 조건판»** (대표 2026-09-18)
 *   「세부검색은 이미 화이트라벨이나 레트로 화면에 만들어 놓은 필터」
 *   ⚠ 앞서 고르기 칸(select) 여섯 + 찾기 단추였다 — 우리가 이미 만든 것을 두고 새로 지은 것이다.
 *   ⇒ 원본 = freepasserp4 `components/shop/ShopFilterSheet.tsx` · `ShopFilters.tsx`(CheckList · CheckRow)의 짜임을 그대로:
 *
 * ```
 *   ┌ 상세 조건 ────────────── 초기화  닫기 ┐
 *   │ 출고상태 2 │ 출고상태           해제  │   ← 왼쪽 = 축 지도(늘 보인다) · 고른 개수
 *   │ 상품구분   │ ☑ 즉시출고          128  │   ← 오른쪽 = 값 · 건수(교차 집계)
 *   │ 혜택       │ ☐ 출고협의           12  │
 *   │ 계약기간   │ ☐ 출고불가            0  │   ← 0 이어도 줄은 선다(2026-09-10 「0이라고 해줘야지」)
 *   ├────────────┴──────────────────────────┤
 *   │             [ 132대 보기 ]            │   ← 적용/취소 없음 — 고르는 즉시 걸리고, 결과 수만 말한다
 *   └───────────────────────────────────────┘
 * ```
 * ★같은 축 안은 «또는», 축끼리는 «이면서» — 값은 여러 개를 고른다(네모).
 * ★고르면 주소만 바뀐다(`?status=즉시출고,출고협의`) — 쪽을 안 옮긴다(절대 법칙). 판은 그대로 열려 있고 숫자만 바뀐다.
 * ★모양은 우리 옷: 선은 판 박스 하나 · 고른 것은 남색 면/글자로만(규칙 ①) · 글 셋(제목 · 메인 · 보조).
 * 폰은 아래에서 올라오는 시트(82vh) — 원본 그대로. 웹은 검색창 바로 밑에 같은 폭으로 뜬다.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { 고른값 } from './pick';

export type FacetOption = { key: string; label: string; count: number };
/** 축 하나 — key 는 곧 주소 칸 이름이다 */
export type FacetAxis = { key: string; label: string; options: FacetOption[] };

/** 긴 목록은 머리 여덟만 — 원본 `HEAD_COUNT` */
const HEAD_COUNT = 8;


export function FilterSheet({ axes, count, unit, label = '세부검색' }: {
  axes: FacetAxis[];
  /** 지금 조건으로 남는 수 — 바닥 단추가 든다 */
  count: number;
  unit: '대' | '건';
  /** 단추 글자 — 폰은 「세부검색」(원본 그대로), PC 규격 화면(erp-searchbar)은 「필터」(§5-1, 대표
   *  2026-09-24 「검색창 옆에는 필터 버튼이 있다」)로 다르게 부른다. */
  label?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  /** 값이 하나도 없는 축은 안 세운다 — 눌러도 빈 칸이 나오는 이름을 지도에 두지 않는다(원본) */
  const shown = useMemo(() => axes.filter((a) => a.options.length), [axes]);
  const sel = (a: string) => 고른값(params.get(a));
  const total = shown.reduce((n, a) => n + sel(a.key).length, 0);
  const [active, setActive] = useState(() => (shown.find((a) => sel(a.key).length) ?? shown[0])?.key ?? '');
  useEffect(() => { if (shown.length && !shown.some((a) => a.key === active)) setActive(shown[0].key); }, [shown, active]);

  /* 닫기 — 바깥을 누르거나 Esc */
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open, close]);

  const go = (edit: (u: URLSearchParams) => void) => {
    const u = new URLSearchParams(params.toString());
    edit(u);
    u.delete('page');
    start(() => router.replace(`${path}?${u}`, { scroll: false }));
  };
  const toggle = (axis: string, key: string) => go((u) => {
    const cur = 고른값(u.get(axis));
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    if (next.length) u.set(axis, next.join(',')); else u.delete(axis);
  });
  const clearAxis = (axis: string) => go((u) => u.delete(axis));
  const clearAll = () => go((u) => { for (const a of axes) u.delete(a.key); });

  const cur = shown.find((a) => a.key === active);
  return (
    <div className="dz-fs" ref={box}>
      <button ref={trigger} type="button" className={`dz-fs-open${open ? ' on' : ''}`}
        onClick={() => open ? close() : setOpen(true)} aria-expanded={open} aria-haspopup="dialog" aria-controls={dialogId}>
        {label}{total ? <i>{total}</i> : null}
      </button>
      {open && (
        <div className="dz-fs-back" onClick={close}>
          <div id={dialogId} className="dz-fs-sheet" role="dialog" aria-label="상세 조건" onClick={(e) => e.stopPropagation()}>
            <div className="dz-fs-head">
              <b>상세 조건</b>
              <button type="button" onClick={close} aria-label="닫기">닫기</button>
            </div>
            <div className="dz-fs-body">
              {/* 왼쪽 — 축 지도. 오른쪽과 «따로» 구른다 */}
              <nav aria-label="조건 항목">
                {shown.map((a) => {
                  const n = sel(a.key).length;
                  return (
                    <button key={a.key} type="button" className={a.key === active ? 'on' : ''}
                      aria-current={a.key === active ? 'true' : undefined} onClick={() => setActive(a.key)}>
                      <span>{a.label}</span>{n ? <i>{n}</i> : null}
                    </button>
                  );
                })}
              </nav>
              {/* 오른쪽 — 고른 축의 값 */}
              <div className={`dz-fs-vals${pending ? ' wait' : ''}`} aria-busy={pending}>
                {cur && <>
                  <div className="dz-fs-axis">
                    <b>{cur.label}</b>
                    {sel(cur.key).length ? <button type="button" onClick={() => clearAxis(cur.key)}>해제</button> : null}
                  </div>
                  <CheckList key={cur.key} axis={cur} selected={sel(cur.key)} onToggle={toggle} />
                </>}
              </div>
            </div>
            {/* 하단바 규격(dz-bar) — 보조(초기화) 왼쪽 작게 · 주 단추가 나머지 */}
            <div className="dz-fs-foot dz-bar-go">
              {total ? <button type="button" className="dz-bar-sub" onClick={clearAll}>초기화</button> : null}
              <button type="button" className="primary" onClick={close}>
                {count.toLocaleString('ko-KR')}{unit} 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 체크 목록 — 원본 `CheckList`. 긴 목록은 머리 여덟만, 나머지는 「더보기」.
 * ★고른 값이 접힌 자리에 있으면 처음부터 펼친다 — 걸어 둔 조건이 안 보이면 그게 «숨은 필터»다.
 * ★한 열 — 두 열이면 건수가 옆 칸 라벨에 붙어 읽힌다(원본 2026-09-06 실측).
 */
function CheckList({ axis, selected, onToggle }: {
  axis: FacetAxis; selected: string[]; onToggle: (axis: string, key: string) => void;
}) {
  const hiddenHasPick = axis.options.slice(HEAD_COUNT).some((o) => selected.includes(o.key));
  const [all, setAll] = useState(false);
  const list = all || hiddenHasPick ? axis.options : axis.options.slice(0, HEAD_COUNT);
  const rest = axis.options.length - list.length;
  return (
    <>
      {list.map((o) => {
        const on = selected.includes(o.key);
        return (
          /* ★네모 — 여러 개를 고르는 축이다(원형이면 «하나만»으로 읽힌다) */
          <button key={o.key} type="button" className={`dz-fs-check${on ? ' on' : ''}${o.count ? '' : ' zero'}`}
            aria-pressed={on} onClick={() => onToggle(axis.key, o.key)}>
            <span className="box" aria-hidden>{on ? '✓' : ''}</span>
            <span className="lab">{o.label}</span>
            <span className="n">{o.count.toLocaleString('ko-KR')}</span>
          </button>
        );
      })}
      {rest > 0 && <button type="button" className="dz-fs-more" onClick={() => setAll(true)}>더보기 {rest}</button>}
    </>
  );
}
