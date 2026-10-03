'use client';
/**
 * 고른 접수 하나의 처리 판 — 기존 판(`.pb`)의 머리 · 구역 · 입력칸 · 단추 그대로.
 * ★기존 저장 경로가 있는 것만 고칠 수 있다:
 *   계약서 · 차량번호 · 인도/인도일 · 취소 → progressAction
 *   청구월 → lifecycleAction(billMonth)
 *   청구액 · 지급액 → feeAction (사유 필수 — 감사 이력에 남는다)
 * 나머지(고객·공급사·조건 …)는 아직 고치는 경로가 없어 보기만 한다. 가짜로 고친 척하지 않는다.
 */
import { useState } from 'react';
import { factsAction, feeAction, lifecycleAction, progressAction } from '../intake/actions';
import type { IntakeOptions } from '../intake/new/IntakeForm';
import { LEDGER_PRODUCTS } from '../../domain/settlement/product-kind';
import { formatTermInput, formatWonInput, normName, parseWon, STEPS, stepsOf, toneOf, won, type LedgerRow } from './model';
import type { Run, Status } from './LedgerBoard';

const TAG = { red: 'bad', yellow: 'warn', green: 'good', gray: '' } as const;

export function DetailPanel({ row: r, options, canWrite, today, run, status, onClose, onNew }: {
  row: LedgerRow; options: IntakeOptions; canWrite: boolean; today: string; run: Run; status: Status; onClose: () => void; onNew: () => void;
}) {
  const who = r.plate || r.customer || '접수';
  const off = !canWrite || r.cancelled;
  const [plate, setPlate] = useState(r.plate);
  const [deliveredAt, setDeliveredAt] = useState(r.deliveredAt || today);
  const [month, setMonth] = useState(r.billMonth || r.expectedMonth);
  const [claim, setClaim] = useState(won(r.claim));
  const [pay, setPay] = useState(won(r.pay));
  const [feeReason, setFeeReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [askCancel, setAskCancel] = useState(false);
  const [moneyError, setMoneyError] = useState('');

  const progress = (label: string, fields: Record<string, string>) => run(`${who} ${label}`, progressAction, { code: r.code, ...fields });

  async function saveMoney() {
    const c = parseWon(claim), p = parseWon(pay);
    if (Number.isNaN(c) || Number.isNaN(p)) { setMoneyError('숫자만 넣어 주세요'); return; }
    const fields: Record<string, string> = { code: r.code, feeReason: feeReason.trim() };
    if (c !== null && c !== r.claim) fields.feeClaim = String(c);
    if (p !== null && p !== r.pay) fields.feePay = String(p);
    if (!fields.feeClaim && !fields.feePay) { setMoneyError('바뀐 금액이 없습니다'); return; }
    if (!fields.feeReason) { setMoneyError('고치는 사유를 넣어 주세요 — 변경 이력에 남습니다'); return; }
    setMoneyError('');
    if (await run(`${who} 금액`, feeAction, fields)) setFeeReason('');
  }

  async function cancel() {
    if (!cancelReason.trim()) return;
    if (await progress(r.cancelled ? '취소 해제' : '취소', { kind: 'cancelled', on: r.cancelled ? '0' : '1', reason: cancelReason.trim() })) {
      setAskCancel(false); setCancelReason('');
    }
  }

  const tone = toneOf(r);
  const moneyDirty = claim !== won(r.claim) || pay !== won(r.pay);
  /* 취소 기준(FUNCTION-AUTHORITY): 인도 후에는 접수취소가 아니라 계약해지 + 환수 검토 */
  const cancellable = !(r.delivered && !r.cancelled);

  return (
    <>
      <header className="web-panel-head">
        <h2>{r.customer || '고객 미정'}</h2><span>{r.plate || '차번 미정'}</span>
        <button type="button" className="panel-close" onClick={onClose} aria-label="닫기">×</button>
      </header>

      <div className="web-scroll">
        {status && <p className={status.kind === 'ok' ? 'notice ok' : 'pb-errs'} role={status.kind === 'ok' ? 'status' : 'alert'}>{status.text}</p>}
        {!canWrite && <p className="notice warn" role="status">지금은 저장이 꺼져 있습니다 — 보기만 할 수 있습니다.</p>}

        <div className="ldesk-state">
          <b className={`tag ${TAG[tone]}`}>{r.cancelled ? '취소된 접수' : r.block ? `다음 할 일 · ${r.block}` : '완료'}</b>
          <span className="ldesk-steps">{stepsOf(r).map((s, i) => <i key={i} className={s}>{STEPS[i]}</i>)}</span>
        </div>

        <div className="section">
          <h4>진행</h4>
          <div className="form">
            <label>계약서 받음
              <input type="checkbox" checked={r.paper} disabled={off} onChange={(e) => void progress('계약서', { kind: 'paper', on: e.target.checked ? '1' : '0' })} />
            </label>
            <div className="ldesk-line">
              <span>차량번호</span>
              <input value={plate} onChange={(e) => setPlate(e.target.value)} disabled={off} placeholder="예: 12가3456" aria-label="차량번호" />
              <button type="button" className="small-btn" disabled={off || plate.trim() === r.plate}
                onClick={() => void progress('차량번호', { kind: 'plate', plate: plate.trim() })}>저장</button>
            </div>
            <label>인도 완료
              <input type="checkbox" checked={r.delivered} disabled={off}
                onChange={(e) => void progress('인도', { kind: 'delivered', on: e.target.checked ? '1' : '0', deliveredAt })} />
            </label>
            <div className="ldesk-line">
              <span>인도일</span>
              <input type="date" value={deliveredAt} max={today} onChange={(e) => setDeliveredAt(e.target.value)} disabled={off} aria-label="인도일" />
              <button type="button" className="small-btn" disabled={off || !r.delivered || !deliveredAt || deliveredAt === r.deliveredAt}
                onClick={() => void progress('인도일', { kind: 'delivered', on: '1', deliveredAt })}>저장</button>
            </div>
            <div className="ldesk-line">
              <span>청구월</span>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={off || !r.delivered} aria-label="청구월" />
              <button type="button" className="small-btn" disabled={off || !r.delivered || !month || month === r.billMonth}
                onClick={() => void run(`${who} 청구월`, lifecycleAction, { code: r.code, kind: 'billMonth', month })}>저장</button>
            </div>
          </div>
          {!r.delivered && !r.cancelled && <p className="ldesk-hint">인도일은 「인도 완료」를 체크할 때 함께 저장되고, 청구월은 인도 뒤에 정합니다.</p>}
        </div>

        <div className="section">
          <h4>금액 <span className="dz-sec-note">공급가액 · 부가세 별도</span></h4>
          <div className="form">
            <label>청구액<input className="ldesk-num" inputMode="numeric" value={claim} onChange={(e) => setClaim(e.target.value)} onBlur={(e) => setClaim(formatWonInput(e.target.value))} disabled={off} placeholder="미확정" /></label>
            <label>지급액<input className="ldesk-num" inputMode="numeric" value={pay} onChange={(e) => setPay(e.target.value)} onBlur={(e) => setPay(formatWonInput(e.target.value))} disabled={off} placeholder="미확정" /></label>
            {moneyDirty && <>
              <label>수정 사유<input value={feeReason} onChange={(e) => setFeeReason(e.target.value)} disabled={off} placeholder="필수 · 변경 이력에 남습니다" /></label>
              <button type="button" className="small-btn ldesk-wide" disabled={off} onClick={() => void saveMoney()}>금액 저장</button>
            </>}
          </div>
          {moneyError && <p className="pb-errs" role="alert">{moneyError}</p>}
        </div>

        <FactsSection row={r} options={options} canWrite={canWrite} run={run} status={status} />

        {askCancel && (
          <div className="section ldesk-cancel">
            <h4>{r.cancelled ? '취소 해제' : '접수 취소'}</h4>
            <div className="ldesk-line">
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus
                placeholder={r.cancelled ? '취소를 푸는 사유 (필수)' : '취소 사유 (필수)'} aria-label="취소 사유" />
              <button type="button" className="small-btn danger" disabled={!canWrite || !cancelReason.trim()} onClick={() => void cancel()}>{r.cancelled ? '해제' : '취소 확정'}</button>
              <button type="button" className="small-btn" onClick={() => setAskCancel(false)}>그만두기</button>
            </div>
          </div>
        )}
        {!cancellable && <p className="ldesk-hint">인도된 건은 취소 대신 정산관리에서 계약해지로 처리합니다.</p>}
      </div>

      <div className="web-actions">
        <button type="button" className="tertiary" disabled={!canWrite || !cancellable || askCancel} onClick={() => setAskCancel(true)}>{r.cancelled ? '취소 해제' : '접수 취소'}</button>
        <button type="button" className="primary" onClick={onNew}>+ 새 접수</button>
      </div>
    </>
  );
}

/**
 * 접수 내용 — 보기 ↔ 고치기. 고치기는 바뀐 칸만 보낸다(factsAction → factPatch).
 * 접수일은 고칠 수 없다(문서 id·중복 열쇠). 이름을 바꾸면 기존 코드 매핑으로 코드를 맞추고, 없으면 비운다.
 */
type Draft = { customer: string; model: string; supplier: string; product: string; term: string; rent: string; deposit: string; price: string; payKind: string; channel: string; agent: string; note: string };
const draftOf = (r: LedgerRow): Draft => ({
  customer: r.customer, model: r.model, supplier: r.supplier, product: r.product, term: r.term === null ? '' : String(r.term),
  rent: won(r.rent), deposit: won(r.deposit), price: won(r.price), payKind: r.payKind, channel: r.channel, agent: r.agent, note: r.note,
});

function FactsSection({ row: r, options, canWrite, run, status }: { row: LedgerRow; options: IntakeOptions; canWrite: boolean; run: Run; status: Status }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState<Draft>(() => draftOf(r));
  const [err, setErr] = useState('');
  const set = (k: keyof Draft) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const start = () => { setD(draftOf(r)); setErr(''); setEditing(true); };

  async function save() {
    const was = draftOf(r);
    const fields: Record<string, string> = { code: r.code };
    for (const k of Object.keys(d) as (keyof Draft)[]) {
      const v = k === 'term' ? formatTermInput(d[k]) : ['rent', 'deposit', 'price'].includes(k) ? formatWonInput(d[k]) : normName(d[k]);
      if (v !== was[k]) fields[k] = ['rent', 'deposit', 'price'].includes(k) ? v.replace(/,/g, '') : v;
    }
    if ('supplier' in fields) fields.supplierCode = options.supplierCode[fields.supplier] ?? '';
    if ('channel' in fields) fields.channelCode = options.channelCode[fields.channel] ?? '';
    if ('agent' in fields) fields.agentCode = options.agentCode[fields.agent] ?? '';
    if (Object.keys(fields).length === 1) { setEditing(false); return; }
    setErr('');
    if (await run(`${r.plate || r.customer} 접수 내용`, factsAction, fields)) setEditing(false);
    else setErr('저장하지 못했습니다 — 위 안내를 확인해 주세요');
  }

  if (!editing) {
    return (
      <div className="section">
        <h4>접수 내용 {canWrite && !r.cancelled && <button type="button" className="small-btn ldesk-h4-btn" onClick={start}>고치기</button>}</h4>
        <dl className="product-facts compact">
          {/* 차량 정보 → 영업 정보 → 대여 조건 (새 접수와 같은 차례) */}
          <Fact k="접수일" v={r.receivedAt} /><Fact k="공급사" v={r.supplier} />
          <Fact k="모델" v={r.model} /><Fact k="차량가액" v={won(r.price)} />
          <Fact k="담당자" v={r.agent} /><Fact k="영업채널" v={r.channel} />
          <Fact k="상품구분" v={r.product} /><Fact k="계약기간" v={r.term ? `${r.term}개월` : ''} />
          <Fact k="렌탈료(월)" v={won(r.rent)} /><Fact k="보증금" v={won(r.deposit)} />
          <Fact k="분납" v={r.payKind} /><Fact k="메모" v={r.note} wide />
        </dl>
      </div>
    );
  }
  const text = (k: keyof Draft, label: string, list?: string) => (
    <label>{label}<input value={d[k]} list={list} onChange={(e) => set(k)(e.target.value)} onBlur={(e) => set(k)(normName(e.target.value))} /></label>
  );
  const money = (k: keyof Draft, label: string) => (
    <label>{label}<input className="ldesk-num" inputMode="numeric" value={d[k]} onChange={(e) => set(k)(e.target.value)} onBlur={(e) => set(k)(formatWonInput(e.target.value))} placeholder="원" /></label>
  );
  return (
    <div className="section ldesk-edit">
      <h4>접수 내용 고치기 <span className="dz-sec-note">접수일은 고칠 수 없습니다</span></h4>
      <datalist id="ldesk-e-suppliers">{options.suppliers.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="ldesk-e-channels">{options.channels.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="ldesk-e-agents">{options.agents.map((s) => <option key={s} value={s} />)}</datalist>
      <div className="form">
        {/* 차량 정보 → 영업 정보 → 대여 조건 (새 접수와 같은 차례) */}
        {text('supplier', '공급사', 'ldesk-e-suppliers')}
        {text('model', '모델명')}
        {money('price', '차량가액')}
        {text('agent', '담당자', 'ldesk-e-agents')}
        {text('channel', '영업채널', 'ldesk-e-channels')}
        {text('customer', '고객명')}
        {text('note', '메모')}
        <label>상품구분<select value={d.product} onChange={(e) => set('product')(e.target.value)}>
          <option value="">선택</option>{[...new Set([...LEDGER_PRODUCTS, d.product].filter(Boolean))].map((p) => <option key={p}>{p}</option>)}
        </select></label>
        <label>계약기간<input className="ldesk-num" inputMode="numeric" value={d.term} onChange={(e) => set('term')(e.target.value)} onBlur={(e) => set('term')(formatTermInput(e.target.value))} placeholder="개월" /></label>
        {money('rent', '렌탈료(월)')}
        {money('deposit', '보증금')}
        <label>분납<select value={d.payKind} onChange={(e) => set('payKind')(e.target.value)}>
          {[...new Set(['일시납', '2회분납', '3회분납', d.payKind].filter(Boolean))].map((p) => <option key={p}>{p}</option>)}
        </select></label>
      </div>
      {err && <p className="pb-errs" role="alert">{status?.kind === 'err' ? status.text : err}</p>}
      <div className="ldesk-edit-actions">
        <button type="button" className="small-btn" onClick={() => setEditing(false)}>그만두기</button>
        <button type="button" className="primary" disabled={!canWrite} onClick={() => void save()}>저장</button>
      </div>
    </div>
  );
}

function Fact({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return <div className={wide ? 'product-fact wide' : 'product-fact'}><dt>{k}</dt><dd>{v || '—'}</dd></div>;
}
