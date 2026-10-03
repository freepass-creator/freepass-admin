'use client';
/**
 * 접수 관리 — 기존 판(ProductsBoard `.pb`) 모양 그대로.
 *
 * ★사용자 2026-10-03 「목록과 상세 2:1 좋다 · 나눠 놓지 말고 접수할 때만 옆이 열리게 ·
 *   쪼그라들면 항목 하나하나가 카드라서 순서대로 아래로 내려가면 된다 · 폰트 다 맞추고 허접해 보이면 안 된다」
 *   - 평소: 목록이 판 셋 너비를 다 쓴다.
 *   - 「+ 새 접수」 또는 줄을 누르면: 목록 2 : 처리 판 1.
 *   - 줄 = 기존 목록 카드(왼쪽 상태 칸 + 항목들). 항목은 순서대로 흘러 좁아지면 아래 줄로 내려간다. 좌우 스크롤 없음.
 *   - 폰: 한 판씩(목록 ↔ 처리), 기존 판과 같은 상태표시줄 · 바닥 단추.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormState } from '../intake/actions';
import type { ReactNode } from 'react';
import type { IntakeOptions } from '../intake/new/IntakeForm';
import {
  billMonthsOf, countBy, filterLedger, inChip, inTab, LEDGER_CHIPS, LEDGER_TABS, sortLedger, STEPS, stepsOf,
  toneOf, totalsOf, won, type LedgerChip, type LedgerRow, type LedgerTab,
} from './model';
import { EditIntakePanel } from './EditIntakePanel';
import { progressAction } from '../intake/actions';
import { NewIntakePanel } from './NewIntakePanel';

export type Status = { kind: 'ok' | 'err'; text: string } | null;
/** 기존 서버 액션 하나를 부르고 결과를 알린다. 성공이면 true. */
export type Run = (label: string, action: (s: FormState, f: FormData) => Promise<FormState>, fields: Record<string, string>) => Promise<boolean>;

/** 목록용 짧은 날짜 — 2026-09-21 → 26.09.21 */
const shortDay = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(2).replaceAll('-', '.') : d);
/** 상태 칸 글 — 지금 단계 한 단어 */
const TILE: Record<LedgerRow['task'], string> = { 계약: '계약서', 차량: '차번', 인도: '인도', 정산: '정산', 완료: '완료', 취소: '취소' };

export function LedgerBoard({ rows, options, canWrite, today }: { rows: LedgerRow[]; options: IntakeOptions; canWrite: boolean; today: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<LedgerTab>('처리 필요');
  const [chip, setChip] = useState<LedgerChip | null>(null);
  const [q, setQ] = useState('');
  const [month, setMonth] = useState('');
  /** 오른쪽 판 — null = 닫힘, 'new' = 새 접수, 그 밖 = 고른 접수 코드 */
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const tabCounts = useMemo(() => countBy(rows, LEDGER_TABS, inTab), [rows]);
  const chipCounts = useMemo(() => countBy(rows, LEDGER_CHIPS, inChip), [rows]);
  const months = useMemo(() => billMonthsOf(rows), [rows]);
  const shown = useMemo(() => sortLedger(filterLedger(rows, { tab, chip, q, month }), tab, chip), [rows, tab, chip, q, month]);
  const totals = useMemo(() => totalsOf(shown), [shown]);
  const current = open && open !== 'new' ? rows.find((r) => r.code === open) ?? null : null;

  const run: Run = useCallback(async (label, action, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    setBusy(true);
    try {
      const r = await action({ errors: [] }, fd);
      if (r.errors.length) { setStatus({ kind: 'err', text: `${label} — ${r.errors.join(' · ')}` }); return false; }
      setStatus({ kind: 'ok', text: `저장했습니다 · ${label}` });
      return true;
    } catch (e) {
      setStatus({ kind: 'err', text: `${label} — ${(e as Error).message}` });
      return false;
    } finally {
      setBusy(false);
      router.refresh();
    }
  }, [router]);

  const show = (what: string | null) => { setOpen(what); setStatus(null); };
  const onSaved = useCallback((s: Status, code?: string) => {
    setStatus(s);
    if (code) { setJustSaved(code); setTab('처리 필요'); setChip(null); }
    router.refresh();
  }, [router]);

  return (
    <div className="pb ldesk" data-mode="desk" data-panel={open ? 'open' : undefined} data-phone={open ? 'work' : 'list'}>
      {/* 폰 상태표시줄 — 기존 판과 같은 자리 */}
      <header className="statusbar">
        <div><h1>{open ? (current ? current.customer || '접수' : '새 접수') : '접수 관리'}{!open && <span>{tabCounts[tab]}</span>}</h1>
          <small>{open ? (current ? [current.plate, current.model].filter(Boolean).join(' · ') : '* 표시만 넣으면 접수됩니다') : `${chip ?? tab} · 청구액 ${won(totals.claim)}`}</small></div>
        {open
          ? <button type="button" className="panel-close" onClick={() => show(null)} aria-label="닫기">×</button>
          : <button type="button" className="ldesk-new" onClick={() => show('new')}>+ 새 접수</button>}
      </header>

      <div className="web-workspace">
        <section className="web-panel pb-list" aria-label="접수 목록">
          <header className="web-panel-head">
            <h2>접수 관리</h2><span>{shown.length}</span>
            <small>청구액 <b>{won(totals.claim)}</b>{totals.claimUnknown > 0 && <em> · 미확정 {totals.claimUnknown}</em>} · 지급액 <b>{won(totals.pay)}</b></small>
            {open !== 'new' && <button type="button" className="ldesk-new" onClick={() => show('new')}>+ 새 접수</button>}
          </header>

          <div className="list-tools">
            <div className="search">
              <div className="search-field">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="차량번호 · 고객 · 공급사 · 담당자" aria-label="검색" />
              </div>
              <select className="filter-select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="청구월">
                <option value="">청구월 전체</option>
                {months.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="chips" role="tablist" aria-label="업무 상태">
              {LEDGER_TABS.map((t) => (
                <button key={t} type="button" role="tab" className={!chip && tab === t ? 'chip on' : 'chip'} aria-selected={!chip && tab === t}
                  onClick={() => { setTab(t); setChip(null); }}>{t}<i>{tabCounts[t]}</i></button>
              ))}
              {LEDGER_CHIPS.map((c) => (
                <button key={c} type="button" className={['chip', 'ldesk-alert', chip === c ? 'on' : ''].join(' ').trim()} aria-pressed={chip === c}
                  onClick={() => setChip(chip === c ? null : c)}>
                  {c}<i className={c === '금액 미확정' ? 'bad' : 'warn'}>{chipCounts[c]}</i>
                </button>
              ))}
            </div>
          </div>

          {/* 줄 안에서 바로 체크한 결과 — 오른쪽 판이 닫혀 있을 때 여기 보인다 */}
          {status && !open && <p className={status.kind === 'ok' ? 'notice ok' : 'pb-errs'} role={status.kind === 'ok' ? 'status' : 'alert'}>{status.text}</p>}
          <div className="web-scroll">
            <div className="list" role="list">
              {shown.map((r) => {
                const tone = toneOf(r);
                const late = !r.delivered && !r.cancelled && r.ageDays !== null && r.ageDays >= 14;
                const cls = ['row', 'ldesk-row', r.code === open ? 'selected' : '', r.code === justSaved ? 'just-selected' : '', r.cancelled ? 'is-cancelled' : ''].filter(Boolean).join(' ');
                return (
                  <div key={r.code} role="listitem" className={cls} tabIndex={0} aria-current={r.code === open || undefined}
                    onClick={() => show(r.code)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(r.code); } }}>
                    <span className={`ldesk-tile tone-${tone}`}><b>{TILE[r.task]}</b>{r.task !== '완료' && r.task !== '취소' && <small>{r.task === '정산' ? '대기' : '할 일'}</small>}</span>
                    {/* ★접수 내용을 줄에 다 띄운다(사용자 2026-10-03) — 새 접수와 같은 차례: 차량 → 영업 → 대여 조건 → 진행 → 금액 → 메모 */}
                    <span className="ldesk-fields">
                      <F k="day" l="접수일" v={shortDay(r.receivedAt)} sub={!r.delivered && !r.cancelled && r.ageDays !== null ? <em className={late ? 'tag bad' : undefined}>{r.ageDays}일째</em> : null} />
                      <F k="plate" l="차량번호" v={r.plate || '미정'} strong />
                      <F k="supplier" l="공급사" v={r.supplier} />
                      <F k="model" l="모델" v={r.model} />
                      <F k="price" l="차량가액" v={won(r.price)} num />
                      <F k="channel" l="영업채널" v={r.channel} />
                      <F k="agent" l="담당자" v={r.agent} />
                      <F k="customer" l="고객명" v={r.customer} strong />
                      <F k="product" l="상품구분" v={r.product} />
                      <F k="term" l="기간" v={r.term ? `${r.term}개월` : ''} />
                      <F k="rent" l="렌탈료" v={won(r.rent)} num />
                      <F k="deposit" l="보증금" v={won(r.deposit)} num />
                      <F k="pay-kind" l="분납" v={r.payKind} />
                      <span className="f fk-check" onClick={(e) => e.stopPropagation()}>
                        <small>계약서</small>
                        <input type="checkbox" checked={r.paper} disabled={!canWrite || busy || r.cancelled} aria-label={`${r.plate || r.customer} 계약서`}
                          onChange={(e) => void run(`${r.plate || r.customer} 계약서`, progressAction, { code: r.code, kind: 'paper', on: e.target.checked ? '1' : '0' })} />
                      </span>
                      <span className="f fk-check fk-delivered" onClick={(e) => e.stopPropagation()}>
                        <small>인도</small>
                        <span><input type="checkbox" checked={r.delivered} disabled={!canWrite || busy || r.cancelled} aria-label={`${r.plate || r.customer} 인도`}
                          onChange={(e) => void run(`${r.plate || r.customer} 인도`, progressAction, { code: r.code, kind: 'delivered', on: e.target.checked ? '1' : '0', deliveredAt: r.deliveredAt || today })} />
                          {r.deliveredAt && <i>{shortDay(r.deliveredAt)}</i>}</span>
                      </span>
                      <F k="month" l={r.billMonth || !r.expectedMonth ? '청구월' : '청구월(예정)'} v={r.billMonth || r.expectedMonth || '미정'} />
                      <F k="claim" l="청구액" v={r.claim === null ? <b className="tag warn">미확정</b> : won(r.claim)} num strong />
                      <F k="paid" l="지급액" v={r.pay === null ? <b className="tag warn">미확정</b> : won(r.pay)} num strong />
                      <span className="f fk-flow">
                        <small>진행</small>
                        <span className="ldesk-steps" aria-label={`진행 ${TILE[r.task]}`}>{stepsOf(r).map((s, i) => <i key={i} className={s}>{STEPS[i]}</i>)}</span>
                      </span>
                      {r.note && <F k="memo" l="메모" v={r.note} />}
                    </span>
                  </div>
                );
              })}
            </div>            {shown.length === 0 && <p className="empty">{chip || tab === '처리 필요' ? '지금 손댈 접수가 없습니다.' : '조건에 맞는 접수가 없습니다.'}</p>}
          </div>
        </section>

        {open && (
          <section className="web-panel pb-work" aria-label={current ? '접수 처리' : '새 접수'}>
            {current
              ? <EditIntakePanel key={current.code} row={current} options={options} canWrite={canWrite} today={today} status={status}
                  onClose={() => show(null)} onNew={() => show('new')} onDone={(s) => { setStatus(s); router.refresh(); }} />
              : <NewIntakePanel options={options} canWrite={canWrite} today={today} status={status}
                  onClose={() => show(null)} onSaved={onSaved} />}
          </section>
        )}
      </div>
    </div>
  );
}

/** 줄의 한 칸 — 위 이름표 · 아래 값. 빈 값은 「—」. 칸마다 기본 폭이 있어 좁아지면 순서대로 아래 줄로 흐른다. */
function F({ k, l, v, sub, num, strong }: { k: string; l: string; v: ReactNode; sub?: ReactNode; num?: boolean; strong?: boolean }) {
  const empty = v === '' || v === null || v === undefined;
  return (
    <span className={['f', `fk-${k}`, num ? 'num' : '', strong ? 'strong' : ''].filter(Boolean).join(' ')}>
      <small>{l}</small>
      <span className={empty ? 'fk-none' : undefined}>{empty ? '—' : v}{sub ? <> {sub}</> : null}</span>
    </span>
  );
}