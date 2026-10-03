'use client';
/**
 * 새 접수 판. ★필수 6칸(접수일·고객명·공급사·분납·영업채널·담당자)과 자주 쓰는 칸만 펼쳐 두고, 나머지는 「더 입력」 에 접는다.
 *   공급사·영업채널·담당자는 기존 접수에서 뽑은 자동완성(buildIntakeOptions). 담당자를 고르면 채널이 따라온다.
 *   이름에 맞는 기존 코드(공급사·채널·담당자 코드)를 같이 보낸다 — 새 코드를 지어내지 않는다.
 * 저장은 기존 접수 저장 규칙(ledgerCreateAction = createIntakeAction 과 같은 검증·중복 방지)을 그대로 탄다.
 */
import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { ledgerCreateAction, type LedgerCreateState } from '../intake/actions';
import type { IntakeOptions } from '../intake/new/IntakeForm';
import { LEDGER_PRODUCTS } from '../../domain/settlement/product-kind';
import type { Status } from './LedgerBoard';

const newRequestId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()));

export function NewIntakePanel({ options, canWrite, today, onClose, onSaved }: {
  options: IntakeOptions; canWrite: boolean; today: string; onClose: () => void; onSaved: (s: Status, code?: string) => void;
}) {
  const [state, act, pending] = useActionState<LedgerCreateState, FormData>(ledgerCreateAction, { errors: [] });
  const [requestId, setRequestId] = useState(newRequestId);
  const [supplier, setSupplier] = useState('');
  const [channel, setChannel] = useState('');
  const [agent, setAgent] = useState('');
  const [keep, setKeep] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<LedgerCreateState | null>(null);

  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.code) {
      if (formRef.current) clearUncontrolled(formRef.current);
      setRequestId(newRequestId());
      setSupplier('');
      if (!keep) { setChannel(''); setAgent(''); }
      onSaved({ kind: 'ok', text: state.created ? '접수했습니다 — 목록 맨 위 「처리 필요」 에 들어갔습니다' : '이미 있는 접수입니다 — 새로 만들지 않았습니다' }, state.code);
      formRef.current?.querySelector<HTMLInputElement>('input[name="customer"]')?.focus();
    } else if (state.errors.length) {
      onSaved({ kind: 'err', text: state.errors.join(' · ') });
    }
  }, [state, keep, onSaved]);

  function pickAgent(a: string) {
    setAgent(a);
    const ch = options.agentChannel[a];
    if (ch && !channel) setChannel(ch);
  }

  const off = !canWrite || pending;
  return (
    <form ref={formRef} className="ledger-pane" aria-label="새 접수"
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => act(fd)); }}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); formRef.current?.requestSubmit(); } }}>
      <header className="ledger-pane-head">
        <div><h2>새 접수</h2><p><b className="req">*</b> 표시만 넣으면 접수됩니다. 나머지는 나중에 채워도 됩니다.</p></div>
        <button type="button" className="ledger-close" onClick={onClose} aria-label="닫기">✕</button>
      </header>

      <div className="ledger-pane-body">
        <input type="hidden" name="intakeRequestId" value={requestId} />
        <input type="hidden" name="feeReason" value="접수 화면 직접 입력" />
        <input type="hidden" name="supplierCode" value={options.supplierCode[supplier] ?? ''} />
        <input type="hidden" name="channelCode" value={options.channelCode[channel] ?? ''} />
        <input type="hidden" name="agentCode" value={options.agentCode[agent] ?? ''} />
        <datalist id="ledger-suppliers">{options.suppliers.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="ledger-channels">{options.channels.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="ledger-agents">{options.agents.map((s) => <option key={s} value={s} />)}</datalist>

        <section className="ledger-sec">
          <h3>고객 · 차량</h3>
          <div className="ledger-form">
            <Field label="접수일" req><input className="ledger-input" type="date" name="receivedAt" defaultValue={today} max={today} required disabled={off} /></Field>
            <Field label="고객명" req><input className="ledger-input" name="customer" required disabled={off} autoFocus placeholder="홍길동" /></Field>
            <Field label="차량번호"><input className="ledger-input" name="plate" disabled={off} placeholder="없으면 비워 두기" /></Field>
            <Field label="모델명"><input className="ledger-input" name="model" disabled={off} placeholder="쏘렌토 MQ4" /></Field>
          </div>
        </section>

        <section className="ledger-sec">
          <h3>계약</h3>
          <div className="ledger-form">
            <Field label="공급사" req><input className="ledger-input" name="supplier" list="ledger-suppliers" required disabled={off}
              value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="입력하면 목록이 나옵니다" /></Field>
            <Field label="상품구분"><select className="ledger-input" name="product" disabled={off} defaultValue="">
              <option value="">선택</option>{LEDGER_PRODUCTS.map((p) => <option key={p}>{p}</option>)}
            </select></Field>
            <Field label="계약기간(개월)"><input className="ledger-input num" name="term" inputMode="numeric" disabled={off} placeholder="36" /></Field>
            <Field label="렌탈료(월)"><input className="ledger-input num" name="rent" inputMode="numeric" disabled={off} placeholder="500,000" /></Field>
            <Field label="분납" req><select className="ledger-input" name="payKind" required disabled={off} defaultValue="일시납">
              {options.payKinds.slice(0, 3).map((p) => <option key={p}>{p}</option>)}
            </select></Field>
          </div>
        </section>

        <section className="ledger-sec">
          <h3>영업</h3>
          <div className="ledger-form">
            <Field label="담당자" req><input className="ledger-input" name="agent" list="ledger-agents" required disabled={off}
              value={agent} onChange={(e) => pickAgent(e.target.value)} placeholder="고르면 채널이 따라옵니다" /></Field>
            <Field label="영업채널" req><input className="ledger-input" name="channel" list="ledger-channels" required disabled={off}
              value={channel} onChange={(e) => setChannel(e.target.value)} /></Field>
          </div>
        </section>

        <section className="ledger-sec">
          <h3>금액 <small>공급가액 · 모르면 비워 두기</small></h3>
          <div className="ledger-form">
            <Field label="청구액"><input className="ledger-input num" name="feeClaim" inputMode="numeric" disabled={off} placeholder="미확정" /></Field>
            <Field label="지급액"><input className="ledger-input num" name="feePay" inputMode="numeric" disabled={off} placeholder="미확정" /></Field>
          </div>
        </section>

        <details className="ledger-more">
          <summary>더 입력 — 보증금 · 차량가액 · 계약서 · 인도 · 메모</summary>
          <div className="ledger-form">
            <Field label="보증금"><input className="ledger-input num" name="deposit" inputMode="numeric" disabled={off} /></Field>
            <Field label="차량가액"><input className="ledger-input num" name="price" inputMode="numeric" disabled={off} /></Field>
            <label className="ledger-tick"><input type="checkbox" name="paper" disabled={off} />계약서 받음</label>
            <label className="ledger-tick"><input type="checkbox" name="delivered" disabled={off} />인도 완료</label>
            <Field label="인도일"><input className="ledger-input" type="date" name="deliveredAt" max={today} disabled={off} /></Field>
            <Field label="메모" wide><input className="ledger-input" name="note" disabled={off} /></Field>
          </div>
        </details>
      </div>

      <footer className="ledger-pane-foot">
        <label className="ledger-tick"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />저장 후 같은 담당자로 이어서</label>
        <button type="submit" className="ledger-btn primary" disabled={off} title="Ctrl+Enter">{pending ? '저장 중…' : '접수하기'}</button>
      </footer>
    </form>
  );
}

/**
 * 저장 뒤 비우기. ★form.reset() 은 쓰지 않는다 — React 가 쥔 칸(공급사·채널·담당자)의 화면 값까지 지워
 *   「이어서 접수」 가 화면에선 빈칸인데 상태엔 남는 어긋남이 생긴다. 쥐지 않은 칸만 처음 값으로 돌린다.
 */
const CONTROLLED = new Set(['supplier', 'channel', 'agent']);
function clearUncontrolled(form: HTMLFormElement) {
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement) {
      if (el.type === 'hidden' || CONTROLLED.has(el.name) || !el.name) continue;
      if (el.type === 'checkbox') el.checked = el.defaultChecked; else el.value = el.defaultValue;
    } else if (el instanceof HTMLSelectElement) {
      const d = Array.from(el.options).findIndex((o) => o.defaultSelected);
      el.selectedIndex = d >= 0 ? d : 0;
    }
  }
}

function Field({ label, req, wide, children }: { label: string; req?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <label className={wide ? 'ledger-fld wide' : 'ledger-fld'}>
      <span>{label}{req && <b className="req">*</b>}</span>
      {children}
    </label>
  );
}
