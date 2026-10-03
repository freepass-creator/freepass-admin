'use client';
/**
 * 접수 데스크 — 왼쪽 목록(보기) | 오른쪽 판(처리).
 *
 * 목록: 탭(업무 상태) · 손댈 것 칩 · 검색 · 청구월. 한 줄 한 건, 진행 체크라인과 막힌 단계만 진하게.
 * 오른쪽 판: 기본은 «새 접수», 줄을 누르면 그 접수의 진행·금액 처리.
 * 좁은 화면(<1280)은 목록이 카드가 되고, 오른쪽 판은 화면을 덮는다.
 * ★좌우 스크롤 없음(사용자 2026-10-03).
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormState } from '../intake/actions';
import type { IntakeOptions } from '../intake/new/IntakeForm';
import {
  billMonthsOf, countBy, filterLedger, inChip, inTab, LEDGER_CHIPS, LEDGER_TABS, sortLedger, STEPS, stepsOf,
  toneOf, totalsOf, won, type LedgerChip, type LedgerRow, type LedgerTab,
} from './model';
import { DetailPanel } from './DetailPanel';
import { NewIntakePanel } from './NewIntakePanel';

export type Status = { kind: 'ok' | 'err'; text: string } | null;
/** 기존 서버 액션 하나를 부르고 결과를 알린다. 성공이면 true. */
export type Run = (label: string, action: (s: FormState, f: FormData) => Promise<FormState>, fields: Record<string, string>) => Promise<boolean>;

/** 목록용 짧은 날짜 — 2026-09-21 → 26-09-21 (전체 날짜는 칸에 올리면 보인다) */
const shortDay = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(2) : d);

export function LedgerBoard({ rows, options, canWrite, today }: { rows: LedgerRow[]; options: IntakeOptions; canWrite: boolean; today: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<LedgerTab>('처리 필요');
  const [chip, setChip] = useState<LedgerChip | null>(null);
  const [q, setQ] = useState('');
  const [month, setMonth] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  /** 좁은 화면에서 오른쪽 판을 열었나 */
  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const tabCounts = useMemo(() => countBy(rows, LEDGER_TABS, inTab), [rows]);
  const chipCounts = useMemo(() => countBy(rows, LEDGER_CHIPS, inChip), [rows]);
  const months = useMemo(() => billMonthsOf(rows), [rows]);
  const shown = useMemo(() => sortLedger(filterLedger(rows, { tab, chip, q, month }), tab, chip), [rows, tab, chip, q, month]);
  const totals = useMemo(() => totalsOf(shown), [shown]);
  const current = selected ? rows.find((r) => r.code === selected) ?? null : null;

  const run: Run = useCallback(async (label, action, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    setBusy(true);
    try {
      const r = await action({ errors: [] }, fd);
      if (r.errors.length) { setStatus({ kind: 'err', text: `${label} — ${r.errors.join(' · ')}` }); return false; }
      setStatus({ kind: 'ok', text: `저장됨 · ${label}` });
      return true;
    } catch (e) {
      setStatus({ kind: 'err', text: `${label} — ${(e as Error).message}` });
      return false;
    } finally {
      setBusy(false);
      router.refresh();
    }
  }, [router]);

  const openNew = () => { setSelected(null); setStatus(null); setPanelOpen(true); };
  const openRow = (code: string) => { setSelected(code); setStatus(null); setPanelOpen(true); };
  const pickTab = (t: LedgerTab) => { setTab(t); setChip(null); };

  return (
    <section className="erp-screen ledger">
      <div className="ledger-list">
        <header className="ledger-head">
          <h1 className="ledger-title">접수 관리</h1>
          <span className="ledger-sub">전체 {rows.length.toLocaleString('ko-KR')}건</span>
          <button type="button" className="ledger-primary" onClick={openNew}>+ 새 접수</button>
        </header>

        {/* 지금 손댈 것 — 숫자가 크게 보이고, 누르면 그 건만 거른다 */}
        <div className="ledger-chips" role="group" aria-label="지금 손댈 것">
          {LEDGER_CHIPS.map((c) => (
            <button key={c} type="button" className={`ledger-chip tone-${c === '금액 미확정' ? 'red' : 'yellow'}`}
              aria-pressed={chip === c} aria-label={`${c} ${chipCounts[c]}건`} onClick={() => setChip(chip === c ? null : c)}>
              <span>{c}</span><b>{chipCounts[c]}</b>
            </button>
          ))}
        </div>

        <div className="ledger-tools">
          <div className="ledger-tabs" role="tablist" aria-label="업무 상태">
            {LEDGER_TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={!chip && tab === t} onClick={() => pickTab(t)}>
                {t} <span>{tabCounts[t]}</span>
              </button>
            ))}
          </div>
          <input className="ledger-search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="차량번호 · 고객 · 공급사 · 담당자 검색" aria-label="검색" />
          <select className="ledger-month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="청구월">
            <option value="">청구월 전체</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <p className="ledger-sum">
          {chip ? `「${chip}」` : `「${tab}」`} {totals.rows}건 · 청구액 <b>{won(totals.claim)}</b>{totals.claimUnknown > 0 && <em> 미확정 {totals.claimUnknown}</em>}
          {' '}· 지급액 <b>{won(totals.pay)}</b>{totals.payUnknown > 0 && <em> 미확정 {totals.payUnknown}</em>}
        </p>

        <div className="ledger-scroll">
          <table className="ledger-grid">
            <thead>
              <tr>
                <th>접수일</th><th>고객<span>차량번호</span></th><th>모델<span>공급사</span></th><th>상품<span>기간 · 렌탈료</span></th>
                <th>영업채널<span>담당자</span></th><th>진행</th><th className="num">청구액<span>지급액</span></th><th>청구월</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const tone = toneOf(r);
                const late = !r.delivered && !r.cancelled && r.ageDays !== null && r.ageDays >= 14;
                return (
                  <tr key={r.code} tabIndex={0} aria-selected={r.code === selected}
                    className={[r.cancelled ? 'is-cancelled' : '', r.code === justSaved ? 'is-new' : ''].join(' ').trim() || undefined}
                    onClick={() => openRow(r.code)} onKeyDown={(e) => { if (e.key === 'Enter') openRow(r.code); }}>
                    <td data-label="접수일" title={r.receivedAt}>{shortDay(r.receivedAt)}
                      {!r.delivered && !r.cancelled && r.ageDays !== null && <small className={late ? 'late' : undefined}>{r.ageDays}일째</small>}</td>
                    <td data-label="고객"><b>{r.customer || '—'}</b><small>{r.plate || '차번 미정'}</small></td>
                    <td data-label="모델">{r.model || '—'}<small>{r.supplier}</small></td>
                    <td data-label="상품">{r.product || '—'}<small>{[r.term ? `${r.term}개월` : '', won(r.rent)].filter(Boolean).join(' · ')}</small></td>
                    <td data-label="영업">{r.channel}<small>{r.agent}</small></td>
                    <td data-label="진행">
                      <span className="ledger-steps" aria-label={`진행: ${r.task}`}>
                        {stepsOf(r).map((s, i) => <i key={i} className={`step-${s}`} title={STEPS[i]}>{STEPS[i]}</i>)}
                      </span>
                      <span className={`ledger-badge tone-${tone}`}>{r.cancelled ? '취소' : r.block || '완료'}</span>
                    </td>
                    <td data-label="금액" className="num">
                      <span className={r.claim === null ? 'unknown' : undefined}>{r.claim === null ? '미확정' : won(r.claim)}</span>
                      <small className={r.pay === null ? 'unknown' : undefined}>{r.pay === null ? '미확정' : won(r.pay)}</small>
                    </td>
                    <td data-label="청구월">{r.billMonth || (r.expectedMonth ? <small>예정 {r.expectedMonth}</small> : '')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="ledger-empty">{chip || tab === '처리 필요' ? '지금 손댈 접수가 없습니다.' : '조건에 맞는 접수가 없습니다.'}</p>}
        </div>
      </div>

      <aside className="ledger-panel" data-open={panelOpen || undefined} aria-label={current ? '접수 처리' : '새 접수'}>
        {status && <p className={status.kind === 'ok' ? 'ledger-ok' : 'ledger-alert'} role={status.kind === 'ok' ? 'status' : 'alert'}>{status.text}</p>}
        {!canWrite && <p className="ledger-alert" role="status">지금은 저장이 꺼져 있습니다 — 보기만 할 수 있습니다.</p>}
        {current
          ? <DetailPanel key={current.code} row={current} canWrite={canWrite && !busy} today={today} run={run}
              onClose={() => { setSelected(null); setPanelOpen(false); }} onNew={openNew} />
          : <NewIntakePanel options={options} canWrite={canWrite} today={today}
              onClose={() => setPanelOpen(false)}
              onSaved={(s, code) => { setStatus(s); if (code) { setJustSaved(code); setTab('처리 필요'); setChip(null); } router.refresh(); }} />}
      </aside>
    </section>
  );
}
