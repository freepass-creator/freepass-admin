'use client';
/**
 * 새 접수 판.
 *   묶음(Codex codex/intake-ledger-lifecycle 의 접수 필드 묶음을 옮김): 차량 정보 → 영업 정보 → 대여 조건 → 금액.
 *   차량번호를 넣고 「조회」 하면 프리패스 상품 조건(Offer)을 고를 수 있다 — 고르면 «상품 접수» 로 봉인 저장된다.
 *   공급사·영업채널·담당자는 기존 접수에서 뽑은 자동완성(buildIntakeOptions). 담당자를 고르면 채널이 따라온다.
 *   이름에 맞는 기존 코드(공급사·채널·담당자 코드)를 같이 보낸다 — 새 코드를 지어내지 않는다.
 * 저장은 기존 접수 저장 규칙(ledgerCreateAction = createIntakeAction 과 같은 검증·중복 방지·상품 재확인)을 그대로 탄다.
 */
import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { ledgerCreateAction, ledgerPlateLookupAction, type LedgerCreateState } from '../intake/actions';
import type { IntakeOptions } from '../intake/new/IntakeForm';
import { LEDGER_PRODUCTS } from '../../domain/settlement/product-kind';
import { dataFeeAmount } from '../../domain/settlement/fee';
import type { Status } from './LedgerBoard';
import { formatTermInput, formatWonInput, normName, normPlate, plateKey, won, type PlateOffer } from './model';

/* 칸을 떠날 때 공통 규격으로 — 금액 콤마 · 개월 숫자 · 이름 공백 정리 */
const fixWon = (e: { currentTarget: HTMLInputElement }) => { e.currentTarget.value = formatWonInput(e.currentTarget.value); };
const fixTerm = (e: { currentTarget: HTMLInputElement }) => { e.currentTarget.value = formatTermInput(e.currentTarget.value); };
const fixName = (e: { currentTarget: HTMLInputElement }) => { e.currentTarget.value = normName(e.currentTarget.value); };

/** 보내기 직전에도 같은 규격으로 — 칸을 떠나지 않고 바로 저장(Ctrl+Enter)해도 「36개월」·「500000원」·「12가 3456」이 그대로 가지 않게 */
function normalized(fd: FormData, options: IntakeOptions): FormData {
  const get = (k: string) => String(fd.get(k) ?? '');
  for (const k of ['rent', 'deposit', 'price', 'feeClaim', 'feePay']) fd.set(k, formatWonInput(get(k)));
  fd.set('term', formatTermInput(get('term')));
  fd.set('plate', normPlate(get('plate')));
  for (const k of ['customer', 'model', 'supplier', 'channel', 'agent', 'note']) fd.set(k, normName(get(k)));
  /* 코드는 «정규화된» 이름으로 다시 찾는다 — 칸을 떠나지 않고 저장해도 이름과 코드가 같은 기준이 되게 */
  fd.set('supplierCode', options.supplierCode[get('supplier')] ?? '');
  fd.set('channelCode', options.channelCode[get('channel')] ?? '');
  fd.set('agentCode', options.agentCode[get('agent')] ?? '');
  return fd;
}

const newRequestId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()));

export function NewIntakePanel({ options, canWrite, today, status, onClose, onSaved }: {
  options: IntakeOptions; canWrite: boolean; today: string; status: Status; onClose: () => void; onSaved: (s: Status, code?: string) => void;
}) {
  const [state, act, pending] = useActionState<LedgerCreateState, FormData>(ledgerCreateAction, { errors: [] });
  const [requestId, setRequestId] = useState(newRequestId);
  const [supplier, setSupplier] = useState('');
  const [channel, setChannel] = useState('');
  const [agent, setAgent] = useState('');
  const [keep, setKeep] = useState(true);
  /* 차량번호 조회 — 고른 Offer 가 있으면 «상품 접수» */
  const [offers, setOffers] = useState<PlateOffer[]>([]);
  const [lookupMsg, setLookupMsg] = useState('');
  /** 정본 확인 전이라 조회를 보류했나 — 이유를 경고로 보인다 */
  const [held, setHeld] = useState(false);
  const [looking, setLooking] = useState(false);
  const [pick, setPick] = useState<PlateOffer | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<LedgerCreateState | null>(null);

  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.code) {
      if (formRef.current) clearUncontrolled(formRef.current);
      setRequestId(newRequestId());
      setSupplier(''); setOffers([]); setPick(null); setLookupMsg('');
      if (!keep) { setChannel(''); setAgent(''); }
      onSaved({ kind: 'ok', text: state.created ? '접수했습니다 — 목록 맨 위 「처리 필요」 에 들어갔습니다' : '이미 있는 접수입니다 — 새로 만들지 않았습니다' }, state.code);
      formRef.current?.querySelector<HTMLInputElement>('input[name="plate"]')?.focus();
    } else if (state.errors.length) {
      onSaved({ kind: 'err', text: state.errors.join(' · ') });
    }
  }, [state, keep, onSaved]);

  function pickAgent(a: string) {
    setAgent(a);
    const ch = options.agentChannel[a];
    if (ch && !channel) setChannel(ch);
  }

  const currentPlate = () => { const el = formRef.current?.elements.namedItem('plate'); return el instanceof HTMLInputElement ? el.value : ''; };

  function clearFeeSelection() {
    for (const name of ['feeClaim', 'feePay', 'feeReason']) {
      const el = formRef.current?.elements.namedItem(name);
      if (el instanceof HTMLInputElement && el.type !== 'hidden') el.value = '';
    }
    setPick(null);
  }

  async function lookup() {
    const plate = normPlate(currentPlate());
    if (!plate) { setLookupMsg('차량번호를 먼저 넣어 주세요'); return; }
    setLooking(true); clearFeeSelection();
    try {
      const r = await ledgerPlateLookupAction(plate);
      setOffers(r.offers); setLookupMsg(r.message); setHeld(!!r.held);
      if (r.offers.length === 1) choose(r.offers[0]);
    } catch {
      setOffers([]); setLookupMsg('조회하지 못했습니다 — 직접 입력합니다');
    } finally { setLooking(false); }
  }

  /** 조건 고르기 — 화면 칸을 Offer 값으로 채운다(저장 때 서버가 상품을 다시 읽어 같은 값인지 확인한다) */
  function choose(o: PlateOffer) {
    /* 조회한 뒤 차번을 바꿨다면 그 조건은 다른 차의 것이다 — 고르지 않는다(Codex 검토) */
    if (plateKey(currentPlate()) !== o.plate) { setPick(null); setOffers([]); setLookupMsg('차량번호가 조회한 차와 다릅니다 — 다시 조회해 주세요'); return; }
    setPick(o);
    setSupplier(o.supplier);
    const form = formRef.current;
    if (!form) return;
    const put = (name: string, v: string) => { const el = form.elements.namedItem(name); if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = v; };
    put('model', o.model);
    put('product', o.product);
    put('term', o.term === null ? '' : String(o.term));
    put('rent', won(o.rent));
    put('deposit', won(o.deposit));
    put('price', won(o.price));
    put('feeClaim', dataFeeAmount(o.supplierBillingFee) === null ? '' : won(dataFeeAmount(o.supplierBillingFee)));
    put('feePay', dataFeeAmount(o.channelPayoutFee) === null ? '' : won(dataFeeAmount(o.channelPayoutFee)));
    const reason = form.elements.namedItem('feeReason');
    if (reason instanceof HTMLInputElement && reason.type !== 'hidden') reason.value = '';
  }

  const off = !canWrite || pending;
  return (
    /* 판 머리 · 구르는 칸 · 바닥 단추를 한 폼으로 — `.pb-work-form` 은 display:contents (기존 판과 같은 틀) */
    <form ref={formRef} className="pb-work-form" aria-label="새 접수"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = normalized(new FormData(e.currentTarget), options);
        if (pick && plateKey(String(fd.get('plate') ?? '')) !== pick.plate) { onSaved({ kind: 'err', text: '차량번호가 고른 상품 조건의 차와 다릅니다 — 다시 조회해 주세요' }); return; }
        startTransition(() => act(fd));
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); formRef.current?.requestSubmit(); } }}>
      <header className="web-panel-head">
        <h2>새 접수</h2><small><b className="required-mark">*</b> 표시만 넣으면 접수됩니다</small>
        <button type="button" className="panel-close" onClick={onClose} aria-label="닫기">×</button>
      </header>

      <div className="web-scroll">
        {status && <p className={status.kind === 'ok' ? 'notice ok' : 'pb-errs'} role={status.kind === 'ok' ? 'status' : 'alert'}>{status.text}</p>}
        {!canWrite && <p className="notice warn" role="status">지금은 저장이 꺼져 있습니다 — 보기만 할 수 있습니다.</p>}
        <input type="hidden" name="intakeRequestId" value={requestId} />
        {!pick?.supplierBillingFee && !pick?.channelPayoutFee && <input type="hidden" name="feeReason" value="접수 화면 직접 입력" />}
        {pick && <>
          {/* 상품구분 칸은 잠겨(disabled) 보내지지 않으므로 같은 값을 숨은 칸으로 보낸다 */}
          <input type="hidden" name="product" value={pick.product} />
          <input type="hidden" name="sourceProductId" value={pick.productId} />
          <input type="hidden" name="sourceOfferId" value={pick.offerId} />
          <input type="hidden" name="sourceProductVersion" value={String(pick.version)} />
          <input type="hidden" name="sourceSnapshotId" value={pick.snapshot} />
        </>}
        <datalist id="ldesk-suppliers">{options.suppliers.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="ldesk-channels">{options.channels.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="ldesk-agents">{options.agents.map((s) => <option key={s} value={s} />)}</datalist>

        <div className="section ldesk-first">
          <h4>차량 정보</h4>
          <div className="form">
            <Field label="접수일" req><input type="date" name="receivedAt" defaultValue={today} max={today} required disabled={off} /></Field>
            <div className="ldesk-line">
              <span>차량번호</span>
              <input name="plate" autoFocus disabled={pending} placeholder="없으면 비워 두기" aria-label="차량번호"
                onBlur={(e) => { e.currentTarget.value = normPlate(e.currentTarget.value); }}
                onChange={() => { if (pick || offers.length) { clearFeeSelection(); setOffers([]); setLookupMsg('차량번호가 바뀌었습니다 — 조건을 다시 조회해 주세요'); } }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); void lookup(); } }} />
              {/* 조회는 읽기만 한다 — 저장이 꺼져 있어도 조건을 볼 수 있다 */}
              <button type="button" className="small-btn" disabled={pending || looking} onClick={() => void lookup()}>{looking ? '조회 중' : '조회'}</button>
            </div>
            {(lookupMsg || offers.length > 0) && (
              <div className="ldesk-offers" role="group" aria-label="프리패스 상품 조건">
                {lookupMsg && <p className={held ? 'notice warn' : 'ldesk-hint'} role={held ? 'status' : undefined}>{lookupMsg}</p>}
                {offers.map((o) => (
                  <button key={o.key} type="button" className={pick?.key === o.key ? 'chip on' : 'chip'} aria-pressed={pick?.key === o.key} onClick={() => choose(o)}>
                    {[o.supplier, o.term ? `${o.term}개월` : '', o.rent !== null ? `월 ${won(o.rent)}` : '', o.deposit ? `보증금 ${won(o.deposit)}` : ''].filter(Boolean).join(' · ')}
                    {/* Data 가 발행하지 않은 금액은 저장도 「미확정」이다 — 화면도 같게 보인다 */}
                    {` · 청구 ${dataFeeAmount(o.supplierBillingFee) === null ? '미확정' : `${won(dataFeeAmount(o.supplierBillingFee))}원`} · 지급 ${dataFeeAmount(o.channelPayoutFee) === null ? '미확정' : `${won(dataFeeAmount(o.channelPayoutFee))}원`}`}
                  </button>
                ))}
                {pick && <button type="button" className="chip" onClick={clearFeeSelection}>직접 입력으로</button>}
              </div>
            )}
            {pick && <p className="notice ok">상품 조건으로 접수합니다 — 공급사·모델·조건 칸은 상품 값으로 잠깁니다. 고치려면 「직접 입력으로」를 누르세요.</p>}
            <Field label="공급사" req><input name="supplier" list="ldesk-suppliers" required disabled={off}
              value={supplier} readOnly={!!pick} onChange={(e) => setSupplier(e.target.value)} onBlur={(e) => setSupplier(normName(e.target.value))} placeholder="입력하면 목록이 나옵니다" /></Field>
            <Field label="모델명"><input name="model" onBlur={fixName} readOnly={!!pick} disabled={off} placeholder="쏘렌토 MQ4" /></Field>
            <Field label="차량가액"><input className="ldesk-num" name="price" onBlur={fixWon} readOnly={!!pick} inputMode="numeric" disabled={off} placeholder="원" /></Field>
          </div>
        </div>

        <div className="section">
          <h4>영업 정보</h4>
          <div className="form">
            <Field label="담당자" req><input name="agent" list="ldesk-agents" required disabled={off}
              value={agent} onChange={(e) => pickAgent(e.target.value)} onBlur={(e) => pickAgent(normName(e.target.value))} placeholder="고르면 채널이 따라옵니다" /></Field>
            <Field label="영업채널" req><input name="channel" list="ldesk-channels" required disabled={off}
              value={channel} onChange={(e) => setChannel(e.target.value)} onBlur={(e) => setChannel(normName(e.target.value))} /></Field>
            <Field label="고객명" req><input name="customer" onBlur={fixName} required disabled={off} placeholder="홍길동" /></Field>
            <Field label="메모"><input name="note" onBlur={fixName} disabled={off} /></Field>
          </div>
        </div>

        <div className="section">
          <h4>대여 조건</h4>
          <div className="form">
            <Field label="상품구분"><select name="product" disabled={off || !!pick} defaultValue="">
              <option value="">선택</option>{LEDGER_PRODUCTS.map((p) => <option key={p}>{p}</option>)}
            </select></Field>
            <Field label="계약기간"><input className="ldesk-num" name="term" onBlur={fixTerm} readOnly={!!pick} inputMode="numeric" disabled={off} placeholder="개월" /></Field>
            <Field label="렌탈료(월)"><input className="ldesk-num" name="rent" onBlur={fixWon} readOnly={!!pick} inputMode="numeric" disabled={off} placeholder="원" /></Field>
            <Field label="보증금"><input className="ldesk-num" name="deposit" onBlur={fixWon} readOnly={!!pick} inputMode="numeric" disabled={off} placeholder="원" /></Field>
            <Field label="분납" req><select name="payKind" required disabled={off} defaultValue="일시납">
              {options.payKinds.slice(0, 3).map((p) => <option key={p}>{p}</option>)}
            </select></Field>
          </div>
        </div>

        <div className="section">
          <h4>금액 <span className="dz-sec-note">공급가액 · 모르면 비워 두기</span></h4>
          <div className="form">
            <Field label="청구액"><input className="ldesk-num" name="feeClaim" onBlur={fixWon} readOnly={dataFeeAmount(pick?.supplierBillingFee) !== null} inputMode="numeric" disabled={off} placeholder="미확정" /></Field>
            <Field label="지급액"><input className="ldesk-num" name="feePay" onBlur={fixWon} readOnly={dataFeeAmount(pick?.channelPayoutFee) !== null} inputMode="numeric" disabled={off} placeholder="미확정" /></Field>
            {(pick?.supplierBillingFee || pick?.channelPayoutFee) && <Field label="수수료 사유"><input name="feeReason" disabled={off} placeholder="미확정 금액 직접 입력 시 필수" /></Field>}
          </div>
        </div>

        <div className="section">
          <h4>진행</h4>
          <div className="form">
            <ToggleField key={`p${requestId}`} label="계약서" name="paper" onText="받음" offText="받기 전" disabled={off} />
            <ToggleField key={`d${requestId}`} label="인도" name="delivered" onText="완료" offText="인도 전" disabled={off} />
            <Field label="인도일"><input type="date" name="deliveredAt" max={today} disabled={off} /></Field>
          </div>
        </div>

      </div>

      <div className="web-actions">
        <label className="ldesk-keep"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />저장 후 같은 담당자로 이어서 접수</label>
        <button type="button" className="tertiary" onClick={onClose}>닫기</button>
        <button type="submit" className="primary" disabled={off} title="Ctrl+Enter 로도 저장됩니다">{pending ? '저장 중…' : '접수하기'}</button>
      </div>
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

export function Field({ label, req, children }: { label: string; req?: boolean; children: ReactNode }) {
  return (
    <label>
      <span>{label}{req && <b className="required-mark"> *</b>}</span>
      {children}
    </label>
  );
}

/**
 * 켜고 끄는 단추 — 체크박스 대신(사용자 2026-10-03 「체크로 할 필요 없이 버튼을 누르면 되지」).
 * 켜지면 숨은 칸에 'on' 을 실어 보낸다(서버는 체크박스와 같은 값으로 읽는다).
 */
export function ToggleField({ label, name, defaultOn = false, onText, offText, disabled, onChange }: {
  label: string; name: string; defaultOn?: boolean; onText: string; offText: string; disabled?: boolean; onChange?: (on: boolean) => void;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="ldesk-toggle-row">
      <span>{label}</span>
      {on && <input type="hidden" name={name} value="on" />}
      <button type="button" className={on ? 'ldesk-toggle on' : 'ldesk-toggle'} aria-pressed={on} disabled={disabled}
        onClick={() => { setOn(!on); onChange?.(!on); }}>{on ? `✓ ${onText}` : offText}</button>
    </div>
  );
}
