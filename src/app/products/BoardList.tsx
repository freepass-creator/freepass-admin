'use client';

import Link, { useLinkStatus } from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../_design/Icon';

export type BoardRow = {
  id: string; href: string; title: string; tag?: string; meta: string; value: string; thumb?: string; price?: string;
  /** 사진 대신 쓰는 글자 자리(목업 접수·계약 카드의 「접수」 등) */
  thumbLabel?: string;
  tagTone?: 'good' | 'warn' | 'bad';
  /** 구분 — 상품구분(신차렌트 · 재렌트 · 구독 …) 같은 «종류». 카드끼리 한눈에 갈리게 제목 앞에 */
  kind?: string;
};

/* 누른 카드는 바로 반응한다 — 다음 화면을 받는 동안 윗줄에 가는 막대(useLinkStatus) */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="row-pending" aria-hidden="true" /> : null;
}

/**
 * 판 목록 — 목업 카드 그대로 (대표 2026-09-22 「ui ux 고도화」 · 「빠릿빠릿하지 않다」)
 *   ① 이어 불러오기: 서버는 첫 창(PAGE 줄)만 보낸다. 끝에 가까워지면 more(offset) 로 다음 PAGE 줄을 받아 붙인다.
 *      ★클릭마다 700줄을 다시 받지 않는다 — 한 번 받은 줄은 이 판이 쥐고 있다.
 *   ② 누르면 그 카드가 «바로» 고른 모양이 된다(서버 답을 기다리지 않는다) + 윗줄 막대.
 *   ③ 키보드: ↑↓ 카드 사이 · Enter 고르기 · `/` 검색칸으로.
 */
export function BoardList({ rows, total, more, selectedId, unit = '대', empty }: {
  rows: BoardRow[]; total?: number; page?: number;
  more?: (offset: number) => Promise<BoardRow[]>;
  selectedId?: string; unit?: string; empty?: string;
}) {
  const 전체 = total ?? rows.length;
  const [items, setItems] = useState(rows);
  const [부르는중, set부르는중] = useState(false);
  const [누른, set누른] = useState<string | undefined>();
  const 판 = useRef<HTMLDivElement>(null);

  /* 조건이 바뀌어 새 목록이 오면 갈아 끼운다(같은 목록이면 이미 더 받은 줄을 버리지 않는다) */
  const 열쇠 = `${rows[0]?.id ?? ''}|${전체}|${rows[0]?.href ?? ''}`;
  const 앞열쇠 = useRef(열쇠);
  useEffect(() => {
    if (앞열쇠.current !== 열쇠) { 앞열쇠.current = 열쇠; setItems(rows); }
    else setItems((cur) => (rows.length > cur.length ? rows : cur));
  }, [열쇠, rows]);
  /* 서버가 새 상품을 그리면 «누른» 표시는 내려놓고 상세는 처음부터 보여 준다.
     목록 위치는 유지한다 — 새로 읽어야 하는 것은 선택 카드가 아니라 상세 내용이다. */
  useEffect(() => {
    set누른(undefined);
    if (!selectedId) return;
    판.current?.closest<HTMLElement>('.pb')
      ?.querySelector<HTMLElement>('.pb-detail > .web-scroll')
      ?.scrollTo({ top: 0, behavior: 'auto' });
  }, [selectedId]);

  /* 끝에 가까워지면 다음 줄 — 스크롤 위치로 판단(판 안 스크롤 · 폰은 창 스크롤) */
  useEffect(() => {
    if (!more || items.length >= 전체 || 부르는중) return;
    const root = 판.current?.closest<HTMLElement>('.web-scroll');
    const 창 = root && getComputedStyle(root).overflowY !== 'visible' ? root : null;
    let 멈춤 = false;
    const 볼 = async () => {
      if (멈춤) return;
      const 남음 = 창 ? 창.scrollHeight - 창.scrollTop - 창.clientHeight
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (남음 > 600) return;
      멈춤 = true;
      set부르는중(true);
      try {
        const next = await more(items.length);
        if (next.length) setItems((cur) => [...cur, ...next.filter((x) => !cur.some((y) => y.id === x.id))]);
      } finally { set부르는중(false); }
    };
    const 대상: HTMLElement | Window = 창 ?? window;
    대상.addEventListener('scroll', 볼, { passive: true });
    void 볼();
    return () => { 멈춤 = true; 대상.removeEventListener('scroll', 볼); };
  }, [more, items.length, 전체, 부르는중]);

  /* `/` — 어디서든 그 판의 검색칸으로(글 쓰는 칸 안에서는 그냥 글자) */
  useEffect(() => {
    const on = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]')) return;
      const s = 판.current?.closest('.web-panel')?.querySelector<HTMLInputElement>('.search-field input');
      if (s) { e.preventDefault(); s.focus(); s.select(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const 이동 = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const 카드 = [...(판.current?.querySelectorAll<HTMLAnchorElement>('a.row') ?? [])];
    const i = 카드.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    e.preventDefault();
    const j = e.key === 'ArrowDown' ? i + 1 : i - 1;
    카드[Math.max(0, Math.min(카드.length - 1, j))]?.focus();
  };

  if (!items.length) return <div className="list"><p className="empty dz-empty">{empty ?? '조건에 맞는 차가 없습니다.'}</p></div>;
  const 고른 = 누른 ?? selectedId;

  return (
    <div className="list" ref={판} onKeyDown={이동} aria-label={`${전체}${unit} · ↑↓로 이동, Enter로 고르기`}>
      {items.map((r) => {
        const on = r.id === 고른;
        return (
          <Link key={r.id} href={r.href} className={`row${on ? ' selected' : ''}${누른 === r.id ? ' just-selected' : ''}`} aria-current={on ? 'true' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              set누른(r.id);
            }}>
            <span className={`thumb${r.thumb ? ' photo' : r.thumbLabel ? ' label' : ' car'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.thumb ? <img src={r.thumb} alt="" loading="lazy" decoding="async" />
                : r.thumbLabel ?? <Icon name="car" size={36} />}
            </span>
            <span className="row-body">
              <span className="row-title">
                {r.kind ? <span className="kind">{r.kind}</span> : null}<b>{r.title}</b>
                {r.price ? <strong className="row-price">{r.price}</strong> : null}
                {r.tag ? <span className={r.price ? 'sr-only' : `tag${r.tagTone ? ` ${r.tagTone}` : ''}`}>{r.tag}</span> : null}
              </span>
              <span className="meta">{r.meta}</span>
              <span className="value">{r.value}</span>
            </span>
            {on && <span className="sr-only"> (선택됨)</span>}
            <Pending />
          </Link>
        );
      })}
      {items.length < 전체 && <div className="list-more" role="status">{items.length} / {전체}{unit}{부르는중 ? ' · 불러오는 중' : ''}</div>}
    </div>
  );
}
