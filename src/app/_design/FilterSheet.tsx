'use client';
/**
 * 세부검색 — 왼쪽 축 지도 / 오른쪽 복수 선택 / 하단 결과 수.
 * 같은 축은 OR, 다른 축은 AND. 0건 조건도 숨기지 않는다.
 * 조건 선택은 URL만 갱신하며 현재 판과 검색어를 유지한다.
 * Desktop은 non-modal popover, Mobile은 배경 조작을 막는 modal sheet.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { 고른값 } from './pick';

export type FacetOption = { key: string; label: string; count: number };
export type FacetAxis = { key: string; label: string; options: FacetOption[] };
const HEAD_COUNT = 8;

export function FilterSheet({ axes, count, unit }: {
  axes: FacetAxis[];
  count: number;
  unit: '대' | '건';
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  // Explicit close / Escape return to the trigger. Outside pointer/focus dismissal does not.
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }, []);

  const shown = useMemo(() => axes.filter((a) => a.options.length), [axes]);
  const sel = (a: string) => 고른값(params.get(a));
  const total = shown.reduce((n, a) => n + sel(a.key).length, 0);
  const [active, setActive] = useState(() => (shown.find((a) => sel(a.key).length) ?? shown[0])?.key ?? '');
  useEffect(() => { if (shown.length && !shown.some((a) => a.key === active)) setActive(shown[0].key); }, [shown, active]);

  useEffect(() => {
    const sheet = dialog.current;
    if (!open || !sheet) return;
    const mq = window.matchMedia('(max-width: 900px)');
    const focusables = () => Array.from(sheet.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((node) => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length > 0 && !node.closest('[inert]'));
    const focusFirst = () => (focusables()[0] ?? sheet).focus({ preventScroll: true });

    // Only sibling branches become inert: never an ancestor of this sheet.
    // Restore exact pre-existing attributes/styles on close, resize and unmount.
    const inertBefore = new Map<HTMLElement, string | null>();
    let scrollBefore: Array<{ node: HTMLElement; value: string; priority: string }> = [];
    const isolate = () => {
      let branch: HTMLElement | null = sheet.parentElement;
      while (branch?.parentElement) {
        const parent: HTMLElement = branch.parentElement;
        for (const sibling of Array.from(parent.children)) {
          if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
          if (!inertBefore.has(sibling)) inertBefore.set(sibling, sibling.getAttribute('inert'));
          sibling.setAttribute('inert', '');
        }
        if (parent === document.body) break;
        branch = parent;
      }
      if (!scrollBefore.length) {
        scrollBefore = [document.documentElement, document.body].map((node) => ({
          node, value: node.style.getPropertyValue('overflow'), priority: node.style.getPropertyPriority('overflow'),
        }));
        for (const { node } of scrollBefore) node.style.setProperty('overflow', 'hidden');
      }
    };
    const release = () => {
      for (const [node, before] of inertBefore) {
        if (before === null) node.removeAttribute('inert'); else node.setAttribute('inert', before);
      }
      inertBefore.clear();
      for (const { node, value, priority } of scrollBefore) {
        if (value) node.style.setProperty('overflow', value, priority); else node.style.removeProperty('overflow');
      }
      scrollBefore = [];
    };
    const syncModal = () => {
      setModal(mq.matches);
      if (mq.matches) {
        isolate();
        if (!sheet.contains(document.activeElement)) focusFirst();
      } else release();
    };
    syncModal();
    mq.addEventListener('change', syncModal);
    const entryFrame = requestAnimationFrame(() => focusables()[0]?.focus({ preventScroll: true }));
    const down = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        if (mq.matches) close(); else setOpen(false);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (!mq.matches || e.key !== 'Tab') return;
      const nodes = focusables();
      if (!nodes.length) { e.preventDefault(); sheet.focus(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!sheet.contains(document.activeElement)) {
        e.preventDefault(); (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const focus = (e: FocusEvent) => {
      if (sheet.contains(e.target as Node)) return;
      if (mq.matches) focusFirst();
      else if (e.target !== document.body && !box.current?.contains(e.target as Node)) setOpen(false);
    };
    // Clearing an axis/reset can remove the focused button. Do not strand focus on body.
    const contentObserver = new MutationObserver(() => {
      if (sheet.isConnected && document.activeElement === document.body) {
        (sheet.querySelector<HTMLElement>('.dz-fs-check') ?? focusables()[0] ?? sheet).focus({ preventScroll: true });
      }
    });
    contentObserver.observe(sheet, { childList: true, subtree: true });
    const backgroundObserver = new MutationObserver((changes) => {
      if (mq.matches && changes.some((change) => !sheet.contains(change.target))) isolate();
    });
    backgroundObserver.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    document.addEventListener('focusin', focus, true);
    return () => {
      cancelAnimationFrame(entryFrame);
      contentObserver.disconnect(); backgroundObserver.disconnect();
      mq.removeEventListener('change', syncModal);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      document.removeEventListener('focusin', focus, true);
      release();
    };
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
        세부검색{total ? <i>{total}</i> : null}
      </button>
      {open && (
        <div className="dz-fs-back" onClick={close}>
          <div ref={dialog} id={dialogId} className="dz-fs-sheet" role="dialog" tabIndex={-1}
            aria-modal={modal || undefined} aria-label="상세 조건" onClick={(e) => e.stopPropagation()}>
            <div className="dz-fs-head">
              <b>상세 조건</b>
              <button type="button" onClick={close} aria-label="닫기">닫기</button>
            </div>
            <div className="dz-fs-body">
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

/** Selected options beyond HEAD_COUNT are never hidden. */
function CheckList({ axis, selected, onToggle }: {
  axis: FacetAxis; selected: string[]; onToggle: (axis: string, key: string) => void;
}) {
  const hiddenHasPick = axis.options.slice(HEAD_COUNT).some((o) => selected.includes(o.key));
  const [all, setAll] = useState(false);
  const optionNodes = useRef(new Map<string, HTMLButtonElement>());
  const revealFrame = useRef<number | null>(null);
  useEffect(() => () => { if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current); }, []);
  const list = all || hiddenHasPick ? axis.options : axis.options.slice(0, HEAD_COUNT);
  const rest = axis.options.length - list.length;
  const reveal = () => {
    const nextKey = axis.options[list.length]?.key;
    setAll(true);
    revealFrame.current = requestAnimationFrame(() => {
      if (nextKey) optionNodes.current.get(nextKey)?.focus();
    });
  };
  return (
    <>
      {list.map((o) => {
        const on = selected.includes(o.key);
        return (
          <button key={o.key} ref={(node) => { if (node) optionNodes.current.set(o.key, node); else optionNodes.current.delete(o.key); }}
            type="button" className={`dz-fs-check${on ? ' on' : ''}${o.count ? '' : ' zero'}`}
            aria-pressed={on} onClick={() => onToggle(axis.key, o.key)}>
            <span className="box" aria-hidden>{on ? '✓' : ''}</span>
            <span className="lab">{o.label}</span>
            <span className="n">{o.count.toLocaleString('ko-KR')}</span>
          </button>
        );
      })}
      {rest > 0 && <button type="button" className="dz-fs-more" onClick={reveal}>더보기 {rest}</button>}
    </>
  );
}
