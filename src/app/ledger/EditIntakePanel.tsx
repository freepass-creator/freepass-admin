'use client';
/**
 * 접수 고치기 — 「새 접수」와 똑같은 입력판에 그 접수 값을 채워 연다. 고치고 저장하면 끝.
 * ★사용자 2026-10-03 「접수는 애초에 접수만 할 수 있으면 됐다 · 접수 상세 같은 걸 어렵게 생각했다」 — 따로 된 상세 판은 없앴다.
 *
 * 저장은 바뀐 칸만, 기존 경로 그대로(새 저장 규칙 없음). 막히는 조건은 각 도메인 규칙이 정한다:
 *   고객·모델·거래처·조건·메모 → factsAction(factPatch)   차량번호·계약서·인도/인도일 → progressAction
 *   청구월 → lifecycleAction(billMonth)                      청구액·지급액 → feeAction(사유 필수)
 * 차례: 조건·차번(인도 전에만 고칠 수 있다) → 계약서 → 인도 → 청구월 → 금액. 하나가 막히면 거기서 멈추고 무엇이 저장됐는지 알린다.
 * 접수일은 고칠 수 없다(문서 id·중복 열쇠). 취소는 바닥 단추(사유 필수, 인도 후에는 계약해지 안내).
 */
import { useState } from 'react';
import { factsAction, feeAction, lifecycleAction, progressAction, type FormState } from '../intake/actions';
import type { IntakeOptions } from '../intake/new/IntakeForm';
import { LEDGER_PRODUCTS } from '../../domain/settlement/product-kind';
import type { Status } from './LedgerBoard';
import { Field, ToggleField } from './NewIntakePanel';
import { formatTermInput, formatWonInput, normName, normPlate, parseWon, won, type LedgerRow } from './model';

type Step = { label: string; action: (s: FormState, f: FormData) => Promise<FormState>; fields: Record<string, string> };

const FACT_TEXT = ['customer', 'model', 'supplier', 'channel', 'agent', 'note', 'product', 'payKind'] as const;
const FACT_MONEY = ['rent', 'deposit', 'price'] as const;

export function EditIntakePanel({ row: r, options, canWrite, today, status, onClose, onNew, onDone }: {
  row: LedgerRow; options: IntakeOptions; canWrite: boolean; today: string; status: Status;
  onClose: () => void; onNew: () => void; onDone: (s: Status) => void;
}) {
  const [supplier, setSupplier] = useState(r.supplier);
  const [channel, setChannel] = useState(r.channel);
  const [agent, setAgent] = useState(r.agent);
  const [delivered, setDelivered] = useState(r.delivered);
  const [busy, setBusy] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const off = !canWrite || busy || r.cancelled;
  const who = r.plate || r.customer || '접수';
  /* 취소 기준(FUNCTION-AUTHORITY): 인도 후에는 접수취소가 아니라 계약해지 + 환수 검토 */
  const cancellable = !(r.delivered && !r.cancelled);

  /** 화면 값 → 바뀐 것만 기존 액션 차례로 */
  function stepsOf(fd: FormData): { steps: Step[]; error?: string } {
    const get = (k: string) => String(fd.get(k) ?? '');
    const steps: Step[] = [];

    const facts: Record<string, string> = { code: r.code };
    for (const k of FACT_TEXT) {
      const v = normName(get(k));
      if (v !== normName(String(r[k] ?? ''))) facts[k] = v;
    }
    for (const k of FACT_MONEY) {
      const v = parseWon(get(k));
      if (Number.isNaN(v)) return { steps: [], error: '금액 칸에는 숫자만 넣어 주세요' };
      if (v !== r[k]) facts[k] = v === null ? '' : String(v);
    }
    const term = formatTermInput(get('term'));
    if (term !== '' && !/^\d+$/.test(term)) return { steps: [], error: '계약기간은 개월 숫자로 넣어 주세요' };
    if ((term === '' ? null : Number(term)) !== r.term) facts.term = term;
    if ('supplier' in facts) facts.supplierCode = options.supplierCode[facts.supplier] ?? '';
    if ('channel' in facts) facts.channelCode = options.channelCode[facts.channel] ?? '';
    if ('agent' in facts) facts.agentCode = options.agentCode[facts.agent] ?? '';
    if (Object.keys(facts).length > 1) steps.push({ label: '접수 내용', action: factsAction, fields: facts });

    const plate = normPlate(get('plate'));
    if (plate !== r.plate) steps.push({ label: '차량번호', action: progressAction, fields: { code: r.code, kind: 'plate', plate } });

    const paper = fd.get('paper') === 'on';
    if (paper !== r.paper) steps.push({ label: '계약서', action: progressAction, fields: { code: r.code, kind: 'paper', on: paper ? '1' : '0' } });

    const isDelivered = fd.get('delivered') === 'on';
    const deliveredAt = get('deliveredAt') || today;
    if (isDelivered !== r.delivered || (isDelivered && deliveredAt !== r.deliveredAt)) {
      steps.push({ label: '인도', action: progressAction, fields: { code: r.code, kind: 'delivered', on: isDelivered ? '1' : '0', deliveredAt } });
    }

    const month = get('billMonth');
    if (month && month !== r.billMonth) steps.push({ label: '청구월', action: lifecycleAction, fields: { code: r.code, kind: 'billMonth', month } });

    const claim = parseWon(get('feeClaim')), pay = parseWon(get('feePay'));
    if (Number.isNaN(claim) || Number.isNaN(pay)) return { steps: [], error: '청구액·지급액에는 숫자만 넣어 주세요' };
    const fee: Record<string, string> = { code: r.code, feeReason: get('feeReason').trim() };
    if (claim !== null && claim !== r.claim) fee.feeClaim = String(claim);
    if (pay !== null && pay !== r.pay) fee.feePay = String(pay);
    if (fee.feeClaim || fee.feePay) {
      if (!fee.feeReason) return { steps: [], error: '청구액·지급액을 고치려면 「금액 수정 사유」를 넣어 주세요 — 변경 이력에 남습니다' };
      steps.push({ label: '금액', action: feeAction, fields: fee });
    }
    return { steps };
  }

  async function save(form: HTMLFormElement) {
    const { steps, error } = stepsOf(new FormData(form));
    if (error) { onDone({ kind: 'err', text: error }); return; }
    if (!steps.length) { onDone({ kind: 'ok', text: '바뀐 내용이 없습니다' }); return; }
    setBusy(true);
    const saved: string[] = [];
    try {
      for (const s of steps) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(s.fields)) fd.set(k, v);
        const res = await s.action({ errors: [] }, fd);
        if (res.errors.length) {
          onDone({ kind: 'err', text: `${who} ${s.label} — ${res.errors.join(' · ')}${saved.length ? ` (먼저 저장됨: ${saved.join(' · ')})` : ''}` });
          return;
        }
        saved.push(s.label);
      }
      onDone({ kind: 'ok', text: `저장했습니다 · ${who} ${saved.join(' · ')}` });
    } catch (e) {
      onDone({ kind: 'err', text: `${who} — ${(e as Error).message}${saved.length ? ` (먼저 저장됨: ${saved.join(' · ')})` : ''}` });
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    const reason = cancelReason.trim();
    if (!reason) return;
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries({ code: r.code, kind: 'cancelled', on: r.cancelled ? '0' : '1', reason })) fd.set(k, v);
      const res = await progressAction({ errors: [] }, fd);
      onDone(res.errors.length ? { kind: 'err', text: `${who} 취소 — ${res.errors.join(' · ')}` } : { kind: 'ok', text: `${who} ${r.cancelled ? '취소를 풀었습니다' : '취소했습니다'}` });
      if (!res.errors.length) { setAskCancel(false); setCancelReason(''); }
    } finally { setBusy(false); }
  }

  const fixWon = (e: { currentTarget: HTMLInputElement }) => { e.currentTarget.value = formatWonInput(e.currentTarget.value); };
  const fixName = (e: { currentTarget: HTMLInputElement }) => { e.currentTarget.value = normName(e.currentTarget.value); };

  return (
    <form className="pb-work-form" aria-label="접수 고치기"
      onSubmit={(e) => { e.preventDefault(); void save(e.currentTarget); }}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.requestSubmit(); } }}>
      <header className="web-panel-head">
        <h2>{r.customer || '고객 미정'}</h2><span>{r.plate || '차번 미정'}</span>
        <button type="button" className="panel-close" onClick={onClose} aria-label="닫기">×</button>
      </header>

      <div className="web-scroll">
        {status && <p className={status.kind === 'ok' ? 'notice ok' : 'pb-errs'} role={status.kind === 'ok' ? 'status' : 'alert'}>{status.text}</p>}
        {!canWrite && <p className="notice warn" role="status">지금은 저장이 꺼져 있습니다 — 보기만 할 수 있습니다.</p>}
        {r.cancelled && <p className="notice warn" role="status">취소된 접수입니다 — 고치려면 먼저 취소를 풉니다.</p>}
        {!r.cancelled && r.block && <p className="ldesk-hint ldesk-next">다음 할 일 · <b>{r.block}</b></p>}
        <datalist id="ldesk-e-suppliers">{options.suppliers.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="ldesk-e-channels">{options.channels.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="ldesk-e-agents">{options.agents.map((s) => <option key={s} value={s} />)}</datalist>

        <div className="section ldesk-first">
          <h4>차량 정보</h4>
          <div className="form">
            <Field label="접수일"><input type="date" defaultValue={r.receivedAt} readOnly title="접수일은 고칠 수 없습니다" /></Field>
            <Field label="차량번호"><input name="plate" defaultValue={r.plate} disabled={off} onBlur={(e) => { e.currentTarget.value = normPlate(e.currentTarget.value); }} placeholder="없으면 비워 두기" /></Field>
            <Field label="공급사" req><input name="supplier" list="ldesk-e-suppliers" required disabled={off}
              value={supplier} onChange={(e) => setSupplier(e.target.value)} onBlur={(e) => setSupplier(normName(e.target.value))} /></Field>
            <Field label="모델명"><input name="model" defaultValue={r.model} onBlur={fixName} disabled={off} /></Field>
            <Field label="차량가액"><input className="ldesk-num" name="price" defaultValue={won(r.price)} onBlur={fixWon} inputMode="numeric" disabled={off} placeholder="원" /></Field>
          </div>
        </div>

        <div className="section">
          <h4>영업 정보</h4>
          <div className="form">
            <Field label="담당자" req><input name="agent" list="ldesk-e-agents" required disabled={off}
              value={agent} onChange={(e) => setAgent(e.target.value)} onBlur={(e) => setAgent(normName(e.target.value))} /></Field>
            <Field label="영업채널" req><input name="channel" list="ldesk-e-channels" required disabled={off}
              value={channel} onChange={(e) => setChannel(e.target.value)} onBlur={(e) => setChannel(normName(e.target.value))} /></Field>
            <Field label="고객명" req><input name="customer" defaultValue={r.customer} onBlur={fixName} required disabled={off} /></Field>
            <Field label="메모"><input name="note" defaultValue={r.note} onBlur={fixName} disabled={off} /></Field>
          </div>
        </div>

        <div className="section">
          <h4>대여 조건</h4>
          <div className="form">
            <Field label="상품구분"><select name="product" defaultValue={r.product} disabled={off}>
              <option value="">선택</option>{[...new Set([...LEDGER_PRODUCTS, r.product].filter(Boolean))].map((p) => <option key={p}>{p}</option>)}
            </select></Field>
            <Field label="계약기간"><input className="ldesk-num" name="term" defaultValue={r.term === null ? '' : String(r.term)}
              onBlur={(e) => { e.currentTarget.value = formatTermInput(e.currentTarget.value); }} inputMode="numeric" disabled={off} placeholder="개월" /></Field>
            <Field label="렌탈료(월)"><input className="ldesk-num" name="rent" defaultValue={won(r.rent)} onBlur={fixWon} inputMode="numeric" disabled={off} placeholder="원" /></Field>
            <Field label="보증금"><input className="ldesk-num" name="deposit" defaultValue={won(r.deposit)} onBlur={fixWon} inputMode="numeric" disabled={off} placeholder="원" /></Field>
            <Field label="분납" req><select name="payKind" defaultValue={r.payKind || '일시납'} required disabled={off}>
              {[...new Set(['일시납', '2회분납', '3회분납', r.payKind].filter(Boolean))].map((p) => <option key={p}>{p}</option>)}
            </select></Field>
          </div>
        </div>

        <div className="section">
          <h4>진행</h4>
          <div className="form">
            <ToggleField label="계약서" name="paper" defaultOn={r.paper} onText="받음" offText="받기 전" disabled={off} />
            <ToggleField label="인도" name="delivered" defaultOn={r.delivered} onText="완료" offText="인도 전" disabled={off} onChange={setDelivered} />
            <Field label="인도일"><input type="date" name="deliveredAt" defaultValue={r.deliveredAt || today} max={today} disabled={off || !delivered} /></Field>
            <Field label="청구월"><input type="month" name="billMonth" defaultValue={r.billMonth || r.expectedMonth} disabled={off || !r.delivered} /></Field>
          </div>
          {!r.delivered && !r.cancelled && <p className="ldesk-hint">청구월은 인도 저장 뒤에 정합니다.</p>}
        </div>

        <div className="section">
          <h4>금액 <span className="dz-sec-note">공급가액 · 부가세 별도</span></h4>
          <div className="form">
            <Field label="청구액"><input className="ldesk-num" name="feeClaim" defaultValue={won(r.claim)} onBlur={fixWon} inputMode="numeric" disabled={off} placeholder="미확정" /></Field>
            <Field label="지급액"><input className="ldesk-num" name="feePay" defaultValue={won(r.pay)} onBlur={fixWon} inputMode="numeric" disabled={off} placeholder="미확정" /></Field>
            <Field label="금액 수정 사유"><input name="feeReason" disabled={off} placeholder="금액을 고칠 때만 · 변경 이력에 남습니다" /></Field>
          </div>
        </div>

        {askCancel && (
          <div className="section ldesk-cancel">
            <h4>{r.cancelled ? '취소 풀기' : '접수 취소'}</h4>
            <div className="ldesk-line">
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus
                placeholder={r.cancelled ? '취소를 푸는 사유 (필수)' : '취소 사유 (필수)'} aria-label="취소 사유" />
              <button type="button" className="small-btn danger" disabled={!canWrite || busy || !cancelReason.trim()} onClick={() => void cancel()}>{r.cancelled ? '풀기' : '취소 확정'}</button>
              <button type="button" className="small-btn" onClick={() => setAskCancel(false)}>그만두기</button>
            </div>
          </div>
        )}
        {!cancellable && <p className="ldesk-hint">인도된 건은 취소 대신 정산관리에서 계약해지로 처리합니다.</p>}
      </div>

      <div className="web-actions">
        {r.cancelled || cancellable
          ? <button type="button" className="tertiary" disabled={!canWrite || busy || askCancel} onClick={() => setAskCancel(true)}>{r.cancelled ? '취소 풀기' : '접수 취소'}</button>
          : <button type="button" className="tertiary" onClick={onNew}>+ 새 접수</button>}
        <button type="submit" className="primary" disabled={off} title="Ctrl+Enter 로도 저장됩니다">{busy ? '저장 중…' : '저장'}</button>
      </div>
    </form>
  );
}
