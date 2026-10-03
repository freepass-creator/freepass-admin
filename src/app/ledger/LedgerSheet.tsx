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
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react';
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

      <div className="ledger-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>접수일</th><th>차량번호</th><th>공급사</th><th>모델명</th><th>영업채널</th><th>영업담당자</th><th>고객명</th>
              <th>상품구분</th><th className="num">기간</th><th className="num">렌탈료</th><th className="num">보증금</th><th className="num">차량가액</th>
              <th>분납</th><th>계약서</th><th>인도완료</th><th>인도일</th><th>청구월</th><th className="num">청구액</th><th className="num">지급액</th>
              <th>취소</th><th>메모</th><th></th>
            </tr>
          </thead>
          <tbody>
            <EntryRow canWrite={canWrite} today={today} onSaved={(s) => { setStatus(s); router.refresh(); }} />
            {shown.map((r) => (
              <tr key={r.code} className={r.cancelled ? 'is-cancelled' : undefined}>
                <td>{r.receivedAt}</td>
                <td><input key={r.plate} className="cell" defaultValue={r.plate} disabled={lock || r.cancelled} aria-label="차량번호"
                  onBlur={(e) => editPlate(r, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></td>
                <td>{r.supplier}</td><td>{r.model}</td><td>{r.channel}</td><td>{r.agent}</td><td>{r.customer}</td>
                <td>{r.product}</td><td className="num">{r.term ?? ''}</td><td className="num">{won(r.rent)}</td>
                <td className="num">{won(r.deposit)}</td><td className="num">{won(r.price)}</td><td>{r.payKind}</td>
                <td className="mid"><input type="checkbox" checked={r.paper} disabled={lock || r.cancelled} aria-label="계약서"
                  onChange={(e) => togglePaper(r, e.target.checked)} /></td>
                <td className="mid"><input type="checkbox" checked={r.delivered} disabled={lock || r.cancelled} aria-label="인도완료"
                  onChange={(e) => setDelivered(r, e.target.checked, r.deliveredAt || today)} /></td>
                {/* 인도 전·취소·잠김이면 날짜 칸 대신 글만 — 빈 「연도-월-일」 틀이 줄마다 깔리지 않게 */}
                <td>{lock || r.cancelled || !r.delivered ? r.deliveredAt
                  : <input key={r.deliveredAt} className="cell" type="date" defaultValue={r.deliveredAt} max={today} aria-label="인도일"
                    onBlur={(e) => { if (e.target.value && e.target.value !== r.deliveredAt) setDelivered(r, true, e.target.value); }} />}</td>
                <td>{lock || r.cancelled || !r.delivered ? r.billMonth
                  : <input key={r.billMonth} className="cell" type="month" defaultValue={r.billMonth} aria-label="청구월"
                    onBlur={(e) => editBillMonth(r, e.target.value)} />}</td>
                <td><input key={`c${r.claim}`} className="cell num" inputMode="numeric" defaultValue={won(r.claim)} disabled={lock || r.cancelled} aria-label="청구액"
                  placeholder="미확정" onBlur={(e) => editFee(r, 'claim', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></td>
                <td><input key={`p${r.pay}`} className="cell num" inputMode="numeric" defaultValue={won(r.pay)} disabled={lock || r.cancelled} aria-label="지급액"
                  placeholder="미확정" onBlur={(e) => editFee(r, 'pay', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></td>
                <td className="mid"><input type="checkbox" checked={r.cancelled} disabled={lock} aria-label="취소"
                  onChange={(e) => toggleCancelled(r, e.target.checked)} /></td>
                <td className="memo" title={r.note}>{r.note}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="ledger-empty">조건에 맞는 접수가 없습니다.</p>}
      </div>
    </section>
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
  return (
    <tr className="ledger-entry">
      <td>
        {/* ★form action 을 그대로 쓰면 React 가 저장 실패에도 입력을 비운다 — 직접 보내고, 성공했을 때만 비운다. */}
        <form id={F} ref={formRef} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => act(fd)); }} />
        <input form={F} type="hidden" name="intakeRequestId" value={requestId} />
        <input form={F} type="hidden" name="feeReason" value="접수표 직접 입력" />
        <input form={F} className="cell" type="date" name="receivedAt" defaultValue={today} max={today} required disabled={off} aria-label="새 접수 접수일" />
      </td>
      <td><input form={F} className="cell" name="plate" disabled={off} aria-label="새 접수 차량번호" placeholder="차량번호" /></td>
      <td><input form={F} className="cell" name="supplier" required disabled={off} aria-label="새 접수 공급사" placeholder="공급사" /></td>
      <td><input form={F} className="cell" name="model" disabled={off} aria-label="새 접수 모델명" placeholder="모델명" /></td>
      <td><input form={F} className="cell" name="channel" required disabled={off} aria-label="새 접수 영업채널" placeholder="영업채널" /></td>
      <td><input form={F} className="cell" name="agent" required disabled={off} aria-label="새 접수 영업담당자" placeholder="담당자" /></td>
      <td><input form={F} className="cell" name="customer" required disabled={off} aria-label="새 접수 고객명" placeholder="고객명" /></td>
      <td><select form={F} className="cell" name="product" disabled={off} aria-label="새 접수 상품구분" defaultValue="">
        <option value="">상품구분</option>{LEDGER_PRODUCTS.map((p) => <option key={p}>{p}</option>)}
      </select></td>
      <td><input form={F} className="cell num" name="term" inputMode="numeric" disabled={off} aria-label="새 접수 계약기간" placeholder="개월" /></td>
      <td><input form={F} className="cell num" name="rent" inputMode="numeric" disabled={off} aria-label="새 접수 렌탈료" placeholder="렌탈료" /></td>
      <td><input form={F} className="cell num" name="deposit" inputMode="numeric" disabled={off} aria-label="새 접수 보증금" placeholder="보증금" /></td>
      <td><input form={F} className="cell num" name="price" inputMode="numeric" disabled={off} aria-label="새 접수 차량가액" placeholder="차량가액" /></td>
      <td><select form={F} className="cell" name="payKind" required disabled={off} aria-label="새 접수 분납여부" defaultValue="">
        <option value="" disabled>분납</option>{PAY_KINDS.map((p) => <option key={p}>{p}</option>)}
      </select></td>
      <td className="mid"><input form={F} type="checkbox" name="paper" disabled={off} aria-label="새 접수 계약서" /></td>
      <td className="mid"><input form={F} type="checkbox" name="delivered" disabled={off} aria-label="새 접수 인도완료" /></td>
      <td><input form={F} className="cell" type="date" name="deliveredAt" max={today} disabled={off} aria-label="새 접수 인도일" /></td>
      <td className="muted">인도 후</td>
      <td><input form={F} className="cell num" name="feeClaim" inputMode="numeric" disabled={off} aria-label="새 접수 청구액" placeholder="청구액" /></td>
      <td><input form={F} className="cell num" name="feePay" inputMode="numeric" disabled={off} aria-label="새 접수 지급액" placeholder="지급액" /></td>
      <td />
      <td><input form={F} className="cell" name="note" disabled={off} aria-label="새 접수 메모" placeholder="메모" /></td>
      <td><button form={F} type="submit" className="ledger-submit" disabled={off}>{pending ? '저장 중' : '접수'}</button></td>
    </tr>
  );
}
