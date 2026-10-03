'use client';
/**
 * 접수표 화면 — 맨 위 입력 줄 + 누적 목록. 엑셀처럼 칸에서 바로 고친다.
 *
 * 고칠 수 있는 칸은 «기존 저장 경로가 있는 칸» 만이다:
 *   차량번호 · 계약서 · 인도완료/인도일 · 취소 → progressAction
 *   청구월 → lifecycleAction(billMonth)
 *   청구액 · 지급액 → feeAction (사유 필수 — 감사 이력에 남는다)
 * 나머지 칸(고객명·공급사·기간·대여료 …)은 아직 고치는 경로가 없어 읽기 전용이다. 가짜로 고친 척하지 않는다.
 */
import { startTransition, type ReactNode, useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { feeAction, lifecycleAction, ledgerCreateAction, progressAction, type FormState, type LedgerCreateState } from '../intake/actions';
import { LEDGER_PRODUCTS } from '../../domain/settlement/product-kind';
import { billMonthsOf, filterLedger, parseWon, totalsOf, won, type LedgerRow } from './model';

const PAY_KINDS = ['일시납', '2회분납', '3회분납'];
const newRequestId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()));

type Status = { kind: 'ok' | 'err'; text: string } | null;

export function LedgerSheet({ rows, canWrite, today }: { rows: LedgerRow[]; canWrite: boolean; today: string }) {
  const router = useRouter();
  const [month, setMonth] = useState('');
  const [q, setQ] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const months = useMemo(() => billMonthsOf(rows), [rows]);
  const shown = useMemo(() => filterLedger(rows, { month, q, showCancelled }), [rows, month, q, showCancelled]);
  const totals = useMemo(() => totalsOf(shown), [shown]);

  /** 한 칸 저장 — 기존 액션을 부르고, 결과를 띠에 알리고, 목록을 다시 읽는다(실패해도 원래 값으로 돌아온다). */
  async function save(label: string, action: (s: FormState, f: FormData) => Promise<FormState>, fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    setBusy(label);
    try {
      const r = await action({ errors: [] }, fd);
      setStatus(r.errors.length ? { kind: 'err', text: `${label} — ${r.errors.join(' · ')}` } : { kind: 'ok', text: `저장됨 · ${label}` });
    } catch (e) {
      setStatus({ kind: 'err', text: `${label} — ${(e as Error).message}` });
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  const ask = (msg: string, fallback = '') => {
    const v = window.prompt(msg, fallback);
    return v === null ? null : v.trim();
  };

  function editPlate(r: LedgerRow, value: string) {
    const plate = value.trim();
    if (plate === r.plate) return;
    void save(`${r.plate || r.customer} 차량번호`, progressAction, { code: r.code, kind: 'plate', plate });
  }
  function togglePaper(r: LedgerRow, on: boolean) {
    void save(`${r.plate || r.customer} 계약서`, progressAction, { code: r.code, kind: 'paper', on: on ? '1' : '0' });
  }
  function setDelivered(r: LedgerRow, on: boolean, date: string) {
    void save(`${r.plate || r.customer} 인도`, progressAction, { code: r.code, kind: 'delivered', on: on ? '1' : '0', deliveredAt: date });
  }
  function toggleCancelled(r: LedgerRow, on: boolean) {
    const reason = ask(on ? '취소 사유를 넣어 주세요' : '취소를 다시 여는 사유를 넣어 주세요');
    if (!reason) { router.refresh(); return; }
    void save(`${r.plate || r.customer} ${on ? '취소' : '취소해제'}`, progressAction, { code: r.code, kind: 'cancelled', on: on ? '1' : '0', reason });
  }
  function editBillMonth(r: LedgerRow, value: string) {
    if (value === r.billMonth) return;
    void save(`${r.plate || r.customer} 청구월`, lifecycleAction, { code: r.code, kind: 'billMonth', month: value });
  }
  function editFee(r: LedgerRow, side: 'claim' | 'pay', value: string) {
    const n = parseWon(value);
    if (n === r[side]) return;
    const label = `${r.plate || r.customer} ${side === 'claim' ? '청구액' : '지급액'}`;
    if (n === null) { setStatus({ kind: 'err', text: `${label} — 금액을 비울 수는 없습니다. 0 이면 0 을 넣어 주세요` }); router.refresh(); return; }
    if (Number.isNaN(n)) { setStatus({ kind: 'err', text: `${label} — 숫자만 넣어 주세요` }); router.refresh(); return; }
    const reason = ask(`${label}을 ${won(n)}원으로 고칩니다. 사유`, '접수표 직접 수정');
    if (!reason) { router.refresh(); return; }
    void save(label, feeAction, { code: r.code, [side === 'claim' ? 'feeClaim' : 'feePay']: String(n), feeReason: reason });
  }

  const lock = !canWrite || busy !== null;

  return (
    <section className="erp-screen ledger">
      <header className="ledger-bar">
        <h1 className="ledger-title">접수표</h1>
        <label className="ledger-field">청구월
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="청구월 필터">
            <option value="">전체</option>
            <option value="none">청구월 없음</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="ledger-field ledger-search">검색
          <input type="search" aria-label="검색" value={q} onChange={(e) => setQ(e.target.value)} placeholder="차량번호 · 고객 · 공급사 · 담당자" />
        </label>
        <label className="ledger-check"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> 취소 포함</label>
        <dl className="ledger-totals">
          <div><dt>건수</dt><dd>{totals.rows.toLocaleString('ko-KR')}</dd></div>
          <div><dt>청구액 합계</dt><dd>{won(totals.claim)}{totals.claimUnknown > 0 && <small>미확정 {totals.claimUnknown}건</small>}</dd></div>
          <div><dt>지급액 합계</dt><dd>{won(totals.pay)}{totals.payUnknown > 0 && <small>미확정 {totals.payUnknown}건</small>}</dd></div>
        </dl>
      </header>

      {!canWrite && <p className="ledger-alert" role="status">지금은 저장이 꺼져 있습니다 — 보기만 할 수 있습니다.</p>}
      {status && <p className={status.kind === 'ok' ? 'ledger-ok' : 'ledger-alert'} role={status.kind === 'ok' ? 'status' : 'alert'}>{status.text}</p>}

      {/*
        ★좌우 스크롤 없음(사용자 2026-10-03) — 표를 화면 폭에 맞춘다. 22칸을 한 줄에 다 펴면 숫자·날짜가 칸 안에서
        끊기므로, 함께 보는 두 칸을 «위·아래» 로 한 칸에 묶어 13열로 줄인다. 세로만 스크롤.
      */}
      <div className="ledger-scroll">
        <table className="ledger-table">
          <thead>
            <tr>{COLS.map((c, i) => <th key={i} className={c.cls}>{c.top}{c.bottom && <><br /><span>{c.bottom}</span></>}</th>)}</tr>
          </thead>
          <tbody>
            <EntryRow canWrite={canWrite} today={today} onSaved={(s) => { setStatus(s); router.refresh(); }} />
            {shown.map((r) => {
              const off = lock || r.cancelled;
              const dateOff = off || !r.delivered;
              return (
                <tr key={r.code} className={r.cancelled ? 'is-cancelled' : undefined}>
                  <Pair i={0} a={r.receivedAt} b={r.product} />
                  <Pair i={1}
                    a={<input key={r.plate} className="cell" defaultValue={r.plate} disabled={off} aria-label="차량번호" placeholder="차량번호"
                      onBlur={(e) => editPlate(r, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />}
                    b={r.model} />
                  <Pair i={2} a={r.customer} b={r.payKind} />
                  <Pair i={3} a={r.supplier} b={r.channel} />
                  <Pair i={4} a={r.agent} b={r.term === null ? '' : `${r.term}개월`} />
                  <Pair i={5} a={won(r.rent)} b={won(r.deposit)} />
                  <Pair i={6} a={won(r.price)} />
                  <Pair i={7}
                    a={<label className="ledger-tick"><input type="checkbox" checked={r.paper} disabled={off} onChange={(e) => togglePaper(r, e.target.checked)} />계약서</label>}
                    b={<label className="ledger-tick"><input type="checkbox" checked={r.delivered} disabled={off} onChange={(e) => setDelivered(r, e.target.checked, r.deliveredAt || today)} />인도</label>} />
                  {/* 인도 전·취소·잠김이면 날짜 칸 대신 글만 — 빈 「연도-월-일」 틀이 줄마다 깔리지 않게 */}
                  <Pair i={8}
                    a={dateOff ? r.deliveredAt : <input key={r.deliveredAt} className="cell" type="date" defaultValue={r.deliveredAt} max={today} aria-label="인도일"
                      onBlur={(e) => { if (e.target.value && e.target.value !== r.deliveredAt) setDelivered(r, true, e.target.value); }} />}
                    b={dateOff ? r.billMonth : <input key={r.billMonth} className="cell" type="month" defaultValue={r.billMonth} aria-label="청구월"
                      onBlur={(e) => editBillMonth(r, e.target.value)} />} />
                  <Pair i={9}
                    a={<input key={`c${r.claim}`} className="cell num" inputMode="numeric" defaultValue={won(r.claim)} disabled={off} aria-label="청구액"
                      placeholder="미확정" onBlur={(e) => editFee(r, 'claim', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />}
                    b={<input key={`p${r.pay}`} className="cell num" inputMode="numeric" defaultValue={won(r.pay)} disabled={off} aria-label="지급액"
                      placeholder="미확정" onBlur={(e) => editFee(r, 'pay', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />} />
                  <Pair i={10} a={<input type="checkbox" checked={r.cancelled} disabled={lock} aria-label="취소" onChange={(e) => toggleCancelled(r, e.target.checked)} />} />
                  <Pair i={11} a={r.note} />
                  <td className="ledger-act" />
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="ledger-empty">조건에 맞는 접수가 없습니다.</p>}
      </div>
    </section>
  );
}

/**
 * 열 — 한 칸에 위·아래 두 값(bottom 이 없으면 한 값). 너비 비율은 ledger.css 가 정한다.
 * 폰(≤900)에서는 줄 하나가 카드로 펼쳐지고, 각 값 앞에 이 이름이 라벨로 붙는다.
 */
const COLS: { top: string; bottom?: string; cls?: string }[] = [
  { top: '접수일', bottom: '상품구분' },
  { top: '차량번호', bottom: '모델명' },
  { top: '고객명', bottom: '분납' },
  { top: '공급사', bottom: '영업채널' },
  { top: '담당자', bottom: '기간' },
  { top: '렌탈료', bottom: '보증금', cls: 'num' },
  { top: '차량가액', cls: 'num' },
  { top: '계약서', bottom: '인도' },
  { top: '인도일', bottom: '청구월' },
  { top: '청구액', bottom: '지급액', cls: 'num' },
  { top: '취소', cls: 'mid' },
  { top: '메모' },
  { top: '' },
];

/** 한 칸 = 위·아래 두 줄. 폰 카드에서 각 줄 앞에 라벨이 붙도록 data-label 을 단다. */
function Pair({ i, a, b }: { i: number; a: ReactNode; b?: ReactNode }) {
  const c = COLS[i];
  return (
    <td className={c.cls}>
      <div className="ledger-pair">
        <div data-label={c.top}>{a}</div>
        {c.bottom && <div data-label={c.bottom}>{b}</div>}
      </div>
    </td>
  );
}

/** 맨 위 입력 줄 — 엑셀의 «새 줄». 저장하면 비우고 같은 자리에서 다음 접수를 받는다. */
function EntryRow({ canWrite, today, onSaved }: { canWrite: boolean; today: string; onSaved: (s: Status) => void }) {
  const [state, act, pending] = useActionState<LedgerCreateState, FormData>(ledgerCreateAction, { errors: [] });
  const [requestId, setRequestId] = useState(newRequestId);
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<LedgerCreateState | null>(null);

  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.code) {
      formRef.current?.reset();
      setRequestId(newRequestId());
      onSaved({ kind: 'ok', text: state.created ? '접수했습니다' : '이미 있는 접수입니다 — 새로 만들지 않았습니다' });
    } else if (state.errors.length) {
      onSaved({ kind: 'err', text: state.errors.join(' · ') });
    }
  }, [state, onSaved]);

  const off = !canWrite || pending;
  const F = 'ledger-new';
  const text = (name: string, label: string, required = false) =>
    <input form={F} className="cell" name={name} required={required} disabled={off} aria-label={`새 접수 ${label}`} placeholder={label} />;
  const num = (name: string, label: string) =>
    <input form={F} className="cell num" name={name} inputMode="numeric" disabled={off} aria-label={`새 접수 ${label}`} placeholder={label} />;
  return (
    <tr className="ledger-entry">
      <td>
        {/* ★form action 을 그대로 쓰면 React 가 저장 실패에도 입력을 비운다 — 직접 보내고, 성공했을 때만 비운다. */}
        <form id={F} ref={formRef} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => act(fd)); }} />
        <input form={F} type="hidden" name="intakeRequestId" value={requestId} />
        <input form={F} type="hidden" name="feeReason" value="접수표 직접 입력" />
        <div className="ledger-pair">
          <div data-label="접수일"><input form={F} className="cell" type="date" name="receivedAt" defaultValue={today} max={today} required disabled={off} aria-label="새 접수 접수일" /></div>
          <div data-label="상품구분"><select form={F} className="cell" name="product" disabled={off} aria-label="새 접수 상품구분" defaultValue="">
            <option value="">상품구분</option>{LEDGER_PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select></div>
        </div>
      </td>
      <td><div className="ledger-pair"><div data-label="차량번호">{text('plate', '차량번호')}</div><div data-label="모델명">{text('model', '모델명')}</div></div></td>
      <td><div className="ledger-pair"><div data-label="고객명">{text('customer', '고객명', true)}</div>
        <div data-label="분납"><select form={F} className="cell" name="payKind" required disabled={off} aria-label="새 접수 분납여부" defaultValue="">
          <option value="" disabled>분납</option>{PAY_KINDS.map((p) => <option key={p}>{p}</option>)}
        </select></div></div></td>
      <td><div className="ledger-pair"><div data-label="공급사">{text('supplier', '공급사', true)}</div><div data-label="영업채널">{text('channel', '영업채널', true)}</div></div></td>
      <td><div className="ledger-pair"><div data-label="담당자">{text('agent', '담당자', true)}</div><div data-label="기간">{num('term', '개월')}</div></div></td>
      <td><div className="ledger-pair"><div data-label="렌탈료">{num('rent', '렌탈료')}</div><div data-label="보증금">{num('deposit', '보증금')}</div></div></td>
      <td><div className="ledger-pair"><div data-label="차량가액">{num('price', '차량가액')}</div></div></td>
      <td><div className="ledger-pair">
        <div data-label="계약서"><label className="ledger-tick"><input form={F} type="checkbox" name="paper" disabled={off} />계약서</label></div>
        <div data-label="인도"><label className="ledger-tick"><input form={F} type="checkbox" name="delivered" disabled={off} />인도</label></div>
      </div></td>
      <td><div className="ledger-pair">
        <div data-label="인도일"><input form={F} className="cell" type="date" name="deliveredAt" max={today} disabled={off} aria-label="새 접수 인도일" /></div>
        <div data-label="청구월" className="muted">인도 후</div>
      </div></td>
      <td><div className="ledger-pair"><div data-label="청구액">{num('feeClaim', '청구액')}</div><div data-label="지급액">{num('feePay', '지급액')}</div></div></td>
      <td />
      <td><div className="ledger-pair"><div data-label="메모">{text('note', '메모')}</div></div></td>
      <td className="ledger-act"><button form={F} type="submit" className="ledger-submit" disabled={off}>{pending ? '저장 중' : '접수'}</button></td>
    </tr>
  );
}
