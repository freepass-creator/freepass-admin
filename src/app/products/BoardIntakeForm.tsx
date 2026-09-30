'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { createIntakeAction, previewFeeAction, type FeePreview, type FormState } from '../intake/actions';
import type { IntakeDefaults, IntakeOptions } from '../intake/new/IntakeForm';

/**
 * 상품판 접수 칸 — 목업 「신규 계약접수」 그대로: 영업채널 · 담당자 · 고객명 + [취소] [저장하기] (대표 2026-09-22)
 *   ★저장은 /intake 신규 접수와 «같은» createIntakeAction — 차 · 요금은 숨은 칸, 서버가 Product/Offer 를 다시 읽어 묶는다.
 *   ★채널·담당을 고르면 원장에 이미 있는 코드를 따라 채운다(지어내지 않는다) — IntakeForm 과 같은 규칙.
 */
export function BoardIntakeForm({ defaults, options, choices, cancelHref, fee, children, disabled = false }: {
  defaults: IntakeDefaults; options: IntakeOptions; choices: string[]; cancelHref: string;
  /** 서버가 미리 센 수수료(저장 때와 같은 셈 · ERP5 수수료표). 상품구분을 고르면 다시 센다 */
  fee: FeePreview | null;
  /** 선택 상품 카드 — 칸 위에 선다 */
  children?: ReactNode;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createIntakeAction, { errors: [] });
  const [channel, setChannel] = useState(defaults.channel ?? '');
  const [agent, setAgent] = useState(defaults.agent ?? '');
  const requestId = useRef(defaults.intakeRequestId);
  const router = useRouter();
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const leaveNotice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (leaveHref) { leaveNotice.current?.scrollIntoView({ block: 'nearest' }); leaveNotice.current?.focus(); } }, [leaveHref]);
  const dirty = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current && !submitting.current) { e.preventDefault(); e.returnValue = ''; }
    };
    const navigate = (e: MouseEvent) => {
      if (!dirty.current || submitting.current || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const u = new URL(link.getAttribute('href')!, location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
      const current = new URL(location.href);
      if (u.origin === current.origin && u.pathname === current.pathname && u.search === current.search) return;
      // Changing only an Offer keeps this product's form mounted and preserves its draft.
      if (u.origin === current.origin && u.pathname === current.pathname && u.searchParams.get('id') === current.searchParams.get('id') && u.searchParams.get('w') === 'new' && !u.searchParams.has('ic')) return;
      e.preventDefault(); e.stopPropagation();
      setLeaveHref(u.href);
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [defaults.sourceProductId]);
  useEffect(() => { if (!pending && state.errors.length) submitting.current = false; }, [pending, state]);
  const 채널코드 = options.channelCode[channel] ?? '';
  const 담당코드 = options.agentCode[agent] ?? '';
  /* ★수수료 — 「이미 기간에 따라서 수수료는 접수할 때도 알아야 하고」(대표 2026-09-18). 상품구분이 갈리면 고른 뒤 다시 센다 */
  const [미리, set미리] = useState<FeePreview | null>(fee);
  const previousFee = useRef(fee);
  useEffect(() => { if (previousFee.current !== fee) { previousFee.current = fee; set미리(fee); } }, [fee]);
  const [구분, set구분] = useState(defaults.product ?? '');
  /* 차량가액 — 신차(선출고 · 견적출고 · 신차발주)는 이 값이 수수료의 산출 근거다(대표 2026-09-23 「신차발주는 신차가격이 있어야지」).
     ERP5 에 차량가가 있으면 그 값이 정본, 없을 때만 사람이 넣는다(#91). */
  const [차량가, set차량가] = useState(defaults.price ?? '');
  const 원장차량가 = !!defaults.price;
  /* 상품구분 · 차량가액이 바뀌면 수수료를 다시 센다 — 치는 대로(0.4초 뒤). 저장 때와 같은 셈이다 */
  const 첫판 = useRef(true);
  useEffect(() => {
    if (첫판.current) { 첫판.current = false; return; }
    let active = true;
    const t = setTimeout(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries({ supplier: defaults.supplier, product: 구분, model: defaults.model, term: defaults.term, rent: defaults.rent, price: 차량가 })) fd.set(k, v);
      const result = await previewFeeAction(fd);
      if (active) set미리(result);
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [구분, 차량가, defaults.supplier, defaults.model, defaults.term, defaults.rent]);
  const 직접 = !!미리 && 미리.status !== 'AUTO' && 미리.status !== 'ERROR';
  /* 기준값(차량가액)이 없어서 못 세는 것이면 — 금액을 직접 넣기 전에 «차량가액 칸»을 먼저 준다 */
  const 기준없음 = !!미리 && 미리.status === 'NO_BASE';
  const 차량가로 = 기준없음 && 미리.basis === '차량가액';
  const 원 = (n: number) => `${n.toLocaleString('ko-KR')}원`;

  return (
    /* ★`action=` 로 넘기면 React 19 가 제출 뒤 칸을 비운다 — 틀려서 되돌아와도 쓴 것이 남게 손으로 넘긴다 */
    <form className="pb-work-form" aria-busy={pending}
      onChange={() => { dirty.current = true; }}
      onSubmit={(e) => { e.preventDefault(); if (disabled || pending) return; submitting.current = true; const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      <input type="hidden" name="intakeRequestId" value={requestId.current ?? ''} />
      <input type="hidden" name="returnContext" value={cancelHref} />
      {(['receivedAt', 'plate', 'model', 'supplier', 'supplierCode', 'term', 'rent', 'deposit', 'rentKind',
        'sourceProductId', 'sourceProductVersion', 'sourceOfferId', 'sourceSnapshotId'] as const).map((k) => (
        <input key={k} type="hidden" name={k} value={defaults[k] ?? ''} />
      ))}
      {(원장차량가 || !차량가로) && <input type="hidden" name="price" value={차량가} />}
      {!choices.length && <input type="hidden" name="product" value={defaults.product ?? ''} />}
      <input type="hidden" name="channelCode" value={채널코드} />
      <input type="hidden" name="agentCode" value={담당코드} />

      <div className="web-scroll">
      {leaveHref && <div ref={leaveNotice} className="notice warn" role="alert" tabIndex={-1}>
        <p>입력 중인 접수가 있습니다. 저장하지 않고 이동할까요?</p>
        <button type="button" className="small-btn" onClick={() => setLeaveHref(null)}>계속 입력</button>{' '}
        <button type="button" className="small-btn danger" onClick={() => { dirty.current = false; router.push(leaveHref); }}>저장하지 않고 이동</button>
      </div>}
      {children}
      {disabled && <p className="notice warn" id="intake-write-reason">조회 전용입니다. 입력 내용을 접수 저장할 수 없습니다.</p>}
      <div className="form">
        <label><span>고객명 <span className="required-mark" aria-hidden="true">*</span></span><input name="customer" defaultValue={defaults.customer} required autoComplete="off" placeholder="고객명을 입력하세요" /></label>
        {choices.length > 0 && (
          <label>상품구분
            <select name="product" value={구분} required onChange={(e) => set구분(e.target.value)}>
              <option value="">선택하세요</option>
              {구분 && !choices.includes(구분) && <option value={구분}>{구분}</option>}
              {choices.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        <label>영업채널{options.channels.length ? (
          <select name="channel" value={channel} required onChange={(e) => setChannel(e.target.value)}>
            <option value="">선택하세요</option>
            {channel && !options.channels.includes(channel) && <option value={channel}>{channel}</option>}
            {options.channels.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : <input name="channel" value={channel} required autoComplete="off" placeholder="영업채널" onChange={(e) => setChannel(e.target.value)} />}</label>
        <label>담당자{options.agents.length ? (
          <select name="agent" value={agent} required onChange={(e) => {
            const a = e.target.value;
            setAgent(a);
            if (!channel && options.agentChannel[a]) setChannel(options.agentChannel[a]);
          }}>
            <option value="">선택하세요</option>
            {agent && !options.agents.includes(agent) && <option value={agent}>{agent}</option>}
            {options.agents.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : <input name="agent" value={agent} required autoComplete="off" placeholder="담당자 이름" onChange={(e) => setAgent(e.target.value)} />}</label>
        <label>분납여부
          <select name="payKind" defaultValue="" required>
            <option value="">선택하세요</option>
            {options.payKinds.filter((v) => ['일시납', '2회분납', '3회분납'].includes(v)).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>계약 방식 <small>(선택)</small>
          <select name="contractType" defaultValue="">
            <option value="">미정</option>
            {options.contractTypes.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <details className="form-disclosure"><summary>메모 <small>(선택)</small></summary><label>메모<textarea name="note" rows={2} placeholder="필요한 내용만 입력하세요" /></label></details>
        {차량가로 && !원장차량가 && (
          <label>차량가액 <small className="pb-hint">수수료 산출 근거 — ERP5 에 없어 사람이 넣습니다</small>
            <input name="price" value={차량가} inputMode="numeric" required placeholder="예: 32,000,000"
              onChange={(e) => set차량가(e.target.value)} /></label>
        )}
        <div className="pb-fee" aria-live="polite">
          <span>수수료</span>
          {!미리 ? <b className="muted">{choices.length ? '상품구분을 고르면 나옵니다' : '—'}</b>
            : 미리.status === 'AUTO' ? <b>청구 {원(미리.claim)} · 지급 {원(미리.pay)}<small className="pb-basis">기준 {미리.basis}</small></b>
              : 미리.status === 'ERROR' ? <b className="muted">수수료표를 못 읽음 — 저장 뒤 접수 화면에서 확인</b>
                : <b className="warn">직접 넣어야 함 — {미리.why}</b>}
        </div>
        {직접 && (
          <>
            <label>청구 수수료<input name="feeClaim" inputMode="numeric" required placeholder="원" /></label>
            <label>지급 수수료<input name="feePay" inputMode="numeric" required placeholder="원" /></label>
            <label>수수료 사유<input name="feeReason" required placeholder="어떻게 정했는지" /></label>
          </>
        )}
        {state.errors.length > 0 && (
          <ul className="pb-errs" role="alert">{state.errors.map((m) => <li key={m}>{m}</li>)}</ul>
        )}
      </div>
      </div>

      <div className="web-actions">
        <Link className="tertiary" href={cancelHref}>취소</Link>
        <button type="submit" className="primary" disabled={pending || disabled} aria-describedby={disabled ? 'intake-write-reason' : undefined} aria-busy={pending}>{pending ? '저장 중…' : '접수 저장'}</button>
      </div>
    </form>
  );
}
