'use client';

import { dataFeeLabel } from '../../../domain/settlement/fee';

import { startTransition, useActionState, useState, type ReactNode } from 'react';
import { createIntakeAction, type FeePreview, type FormState } from '../actions';
import { directIntakeAllowsMissingPlate, directIntakeRentKind } from '../../../domain/settlement/product-kind';

export type IntakeDefaults = {
  receivedAt: string; plate: string; model: string; supplier: string; supplierCode: string;
  term: string; rent: string; deposit: string;
  /** 차에서 온 원장 상품구분 · 렌트구분(기능 ledgerKindOf) · 차량가(수수료 밑값) — 차 골라 접수일 때만 */
  product?: string; rentKind?: string; price?: string;
  intakeRequestId?: string;
  sourceProductId?: string; sourceProductVersion?: string; sourceOfferId?: string; sourceSnapshotId?: string;
  customer?: string; channel?: string; agent?: string;
};
export type IntakeOptions = {
  channels: string[]; channelCode: Record<string, string>;
  agents: string[]; agentCode: Record<string, string>; agentChannel: Record<string, string>;
  suppliers: string[]; supplierCode: Record<string, string>;
  products: string[]; rentKinds: string[]; contractTypes: string[]; payKinds: string[];
};

/**
 * 접수 입력 — ★두 갈래 (대표 2026-09-18)
 *   「신규접수랑 차 골라서 접수랑 다르지.. 차 골라서 접수는 차 내용 있고」
 *   「실제 담당자가 넣는 건 최소한으로 — 기간 선택해서 접수 눌렀을 거고, 영업채널 · 담당자명 · 고객명이면 접수는 끝나지」
 *
 *   picked(차 골라 접수) — 차 · 공급사 · 기간 · 대여료 · 보증금은 «이미 정해졌다»(판 위 카드가 보여 준다 · 숨은 칸으로 간다).
 *                         사람이 넣는 핵심 칸은 넷: 고객명 · 영업채널 · 영업담당 · 분납여부.
 *                         분납여부는 인도 뒤 청구월/실적 갈래를 결정하므로 「더 넣기」에 숨기지 않는다.
 *   blank(신규 접수)     — 차가 없다. 차량 · 고객·영업 · 조건 · 더 넣기 차례로 다 넣는다.
 *   ★하는 일은 기능 쪽 그대로 — 영업채널·담당·공급사를 고르면 원장에 이미 있는 «코드» 를 따라 채운다(지어내지 않는다).
 *   ★필수는 도메인(validateIntake)이 정한다: 차량번호 · 공급사 · 접수일 · 고객명 · 영업채널 · 영업담당.
 */
export default function IntakeForm({ defaults, options, cancelHref, picked, fee, productChoices, ledgerProducts, disabled = false }: {
  defaults: IntakeDefaults; options: IntakeOptions; cancelHref?: string; picked?: boolean;
  /** 차 골라 접수 — 선택 기간의 Data 저장 수수료 */
  fee?: FeePreview | null;
  /**
   * 차 골라 접수에서 상품구분을 «사람이 고를» 말들 — 비었으면 짝이 하나로 떨어진 것(숨은 칸으로 간다).
   * ★원장 상품구분이 수수료 갈래를 정한다(기능 ledgerKindOf).
   * 상품 리스트의 신차렌트는 선출고로 확정된다. 견적출고/신차발주는 직접접수에서만 고른다.
   */
  productChoices?: string[];
  /** 원장 상품구분 전부(기능 LEDGER_PRODUCTS) — 직접 접수의 고를 말 */
  ledgerProducts?: readonly string[];
  /** 쓰기 비활성 등 화면에서 이미 확정된 저장 불가 상태 */
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createIntakeAction, { errors: [] });
  const [channel, setChannel] = useState(defaults.channel ?? '');
  const [agent, setAgent] = useState(defaults.agent ?? '');
  const [channelCode, setChannelCode] = useState(options.channelCode[defaults.channel ?? ''] ?? '');
  const [agentCode, setAgentCode] = useState(options.agentCode[defaults.agent ?? ''] ?? '');
  const [supplierCode, setSupplierCode] = useState(defaults.supplierCode);
  const [directProduct, setDirectProduct] = useState(defaults.product ?? '');
  const [delivered, setDelivered] = useState(false);
  const 미리 = fee;
  const 미리글 = !미리 ? <p className="dz-fee-line dz-muted">저장 수수료 미확정</p>
    : 미리.status === 'READ' ? <p className="dz-fee-line">청구 <b>{dataFeeLabel(미리.supplierBillingFee)}</b> · 지급 <b>{dataFeeLabel(미리.channelPayoutFee)}</b></p>
      : <p className="dz-fee-line warn">{미리.why}</p>;

  const sel = (name: string, list: string[], label: string, value = '', required = false) => (
    <label>{label}{required ? ' *' : ''}
      {/* ★차에서 온 값이 원장 말 목록에 없어도 버리지 않는다(예: 차 「신차렌트」 ↔ 원장 「장기렌트」) —
            버리면 빈 값으로 저장돼 카드의 수수료 미리보기와 저장된 수수료가 갈린다 */}
      <select name={name} defaultValue={value} required={required}>
        <option value="">—</option>
        {value && !list.includes(value) && <option value={value}>{value}</option>}
        {list.map((v) => <option key={v}>{v}</option>)}
      </select>
    </label>
  );
  const 묶음 = (title: string, children: ReactNode) => <fieldset className="dz-form-group"><legend>{title}</legend>{children}</fieldset>;

  /* 사람이 넣는 핵심값 — F04 접수 기준: 고객 · 영업 · 분납여부.
     상품/기간은 이미 선택했고, 분납여부가 인도 뒤 청구월·실적 갈래를 결정한다. */
  const 사람 = (
    <>
      <label>고객명 *<input name="customer" defaultValue={defaults.customer} required autoComplete="off" /></label>
      <label>영업채널 *{options.channels.length ? (
        <select name="channel" value={channel} required
          onChange={(e) => { setChannel(e.target.value); setChannelCode(options.channelCode[e.target.value] ?? ''); }}>
          <option value="">선택하세요</option>
          {channel && !options.channels.includes(channel) && <option value={channel}>{channel}</option>}
          {options.channels.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      ) : <input name="channel" value={channel} required autoComplete="off"
        onChange={(e) => { setChannel(e.target.value); setChannelCode(options.channelCode[e.target.value] ?? ''); }} />}</label>
      <label>영업담당 *{options.agents.length ? (
        <select name="agent" value={agent} required onChange={(e) => {
          const a = e.target.value;
          setAgent(a);
          setAgentCode(options.agentCode[a] ?? '');
          if (!channel && options.agentChannel[a]) { setChannel(options.agentChannel[a]); setChannelCode(options.channelCode[options.agentChannel[a]] ?? ''); }
        }}>
          <option value="">선택하세요</option>
          {agent && !options.agents.includes(agent) && <option value={agent}>{agent}</option>}
          {options.agents.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      ) : <input name="agent" value={agent} required autoComplete="off" onChange={(e) => {
        setAgent(e.target.value); setAgentCode(options.agentCode[e.target.value] ?? '');
      }} />}</label>
      {sel('payKind', options.payKinds.filter((v) => ['일시납', '2회분납', '3회분납'].includes(v)), '분납여부', '', true)}
    </>
  );
  /* 코드 — 이름을 고르면 원장의 코드로 저절로 찬다. 고칠 일이 드물어 뒤로 */
  const 코드 = (
    <>
      <label>채널코드<input name="channelCode" value={channelCode} onChange={(e) => setChannelCode(e.target.value)} /></label>
      <label>영업자코드<input name="agentCode" value={agentCode} onChange={(e) => setAgentCode(e.target.value)} /></label>
    </>
  );
  /* 더 넣기 — 없어도 접수는 선다 */
  const 더 = (
    <details className="dz-form-more">
      <summary>더 넣기 <small>선택 — 없어도 접수됩니다</small></summary>
      <div className="dz-form-grid">
        {picked && <label>접수일<input name="receivedAt" type="date" defaultValue={defaults.receivedAt} required /></label>}
        {!picked && (directIntakeRentKind(directProduct)
          ? <input type="hidden" name="rentKind" value={directIntakeRentKind(directProduct) ?? ''} />
          : sel('rentKind', options.rentKinds, '렌트구분'))}
        {sel('contractType', options.contractTypes, '계약형태')}
        {!picked && <label>공급사코드<input name="supplierCode" value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} /></label>}
        {코드}
        {/* 프로모션 — 공급사가 더 주는 돈 · 영업자 몫은 비우면 100% */}
        <label>프로모션 금액<input name="promoAmount" inputMode="numeric" placeholder="공급사가 더 주는 돈" /></label>
        <label>프로모션 영업자 몫 %<input name="promoSharePct" inputMode="numeric" placeholder="100" /></label>
        <label className="wide">프로모션 사유<input name="promoReason" /></label>
        <label className="check"><input type="checkbox" name="paper" /> 계약서 받음</label>
        <label className="check"><input type="checkbox" name="delivered" checked={delivered} onChange={(e) => setDelivered(e.target.checked)} /> 인도 완료</label>
        {delivered && <label>인도일 *<input name="deliveredAt" type="date" required /></label>}
        <label className="wide">메모<textarea name="note" rows={2} /></label>
      </div>
    </details>
  );

  return (
    /* ★`action=` 로 넘기면 React 19 가 제출 뒤 입력칸을 비운다 — 틀려서 되돌아와도 쓴 것이 다 날아간다.
         그래서 손으로 넘긴다. */
    <form className="dz-intake-form" aria-busy={pending}
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      <datalist id="dl-supplier">{options.suppliers.map((v) => <option key={v} value={v} />)}</datalist>

      <input type="hidden" name="intakeRequestId" value={defaults.intakeRequestId ?? ''} />
      <input type="hidden" name="returnContext" value={cancelHref ?? '/intake'} />
      {picked ? (
        <>
          {/* 차에서 이미 정해진 것 — 판 위 카드가 보여 준다. 여기는 숨은 칸으로만 간다 */}
          {(['plate', 'model', 'supplier', 'term', 'rent', 'deposit'] as const).map((k) => (
            <input key={k} type="hidden" name={k} value={defaults[k] ?? ''} />
          ))}
          <input type="hidden" name="price" value={defaults.price ?? ''} />
          <input type="hidden" name="supplierCode" value={supplierCode} />
          <input type="hidden" name="rentKind" value={defaults.rentKind ?? ''} />
          <input type="hidden" name="sourceProductId" value={defaults.sourceProductId ?? ''} />
          <input type="hidden" name="sourceProductVersion" value={defaults.sourceProductVersion ?? ''} />
          <input type="hidden" name="sourceOfferId" value={defaults.sourceOfferId ?? ''} />
          <input type="hidden" name="sourceSnapshotId" value={defaults.sourceSnapshotId ?? ''} />
          {/* 상품구분 — 짝이 하나면 숨은 칸 · 아니면 사람이 고른다(수수료 갈래가 갈린다) */}
          {productChoices?.length
            ? 묶음('상품구분 — 골라 주세요', (
              <div className="dz-form-grid">
                {sel('product', productChoices, '상품구분', defaults.product ?? '', true)}
              </div>
            ))
            : <input type="hidden" name="product" value={defaults.product ?? ''} />}
          {/* 고른 상품구분의 수수료 — 표가 내면 여기 한 줄, 못 내면 아래 「수수료 — 직접 넣으세요」가 선다(두 번 안 쓴다) */}
          {미리글}
          {묶음('고객 · 영업', <div className="dz-form-grid">{사람}</div>)}
        </>
      ) : (
        <>
          {묶음('차량', (
            <div className="dz-form-grid">
              <label>차량번호{directIntakeAllowsMissingPlate(directProduct) ? ' (배정 후 입력)' : ' *'}
                <input name="plate" defaultValue={defaults.plate} required={!directIntakeAllowsMissingPlate(directProduct)} />
              </label>
              <label>모델<input name="model" defaultValue={defaults.model} /></label>
              <label>공급사 *<input name="supplier" list="dl-supplier" defaultValue={defaults.supplier} required
                onChange={(e) => setSupplierCode(options.supplierCode[e.target.value] ?? '')} /></label>
            </div>
          ))}
          {묶음('고객 · 영업', <div className="dz-form-grid">{사람}</div>)}
          {묶음('조건', (
            <div className="dz-form-grid">
              <label>접수일 *<input name="receivedAt" type="date" defaultValue={defaults.receivedAt} required /></label>
              <label>상품구분
                <select name="product" value={directProduct} onChange={(e) => setDirectProduct(e.target.value)}>
                  <option value="">—</option>
                  {[...(ledgerProducts ?? options.products)].map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label>계약기간(개월)<input name="term" defaultValue={defaults.term} inputMode="numeric" /></label>
              <label>월 대여료<input name="rent" defaultValue={defaults.rent} inputMode="numeric" /></label>
              <label>보증금<input name="deposit" defaultValue={defaults.deposit} inputMode="numeric" /></label>
              <label>차량가액 <small>신차 자동수수료 기준</small><input name="price" inputMode="numeric" /></label>
            </div>
          ))}
          {묶음('수수료', 미리글)}
        </>
      )}
      {더}

      {/* 하단바 규격(dz-bar) — 판 바닥. 신규 접수 중에는 [취소] [접수 저장] (대표 2026-09-18) */}
      <div className="dz-bar">
        {state.errors.length > 0 && <ul className="dz-errs" role="alert" aria-live="assertive">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="dz-bar-go">
          {cancelHref && <a className="dz-bar-sub" href={cancelHref}>취소</a>}
          <button type="submit" className="primary" disabled={disabled || pending} aria-busy={pending}
            aria-describedby={disabled ? 'intake-write-disabled' : undefined}>{pending ? '저장 중…' : '접수 저장'}</button>
        </div>
      </div>
    </form>
  );
}
