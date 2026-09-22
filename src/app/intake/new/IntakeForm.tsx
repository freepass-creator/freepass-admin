'use client';

import { startTransition, useActionState, useRef, useState, type ReactNode } from 'react';
import { createIntakeAction, previewFeeAction, type FeePreview, type FormState } from '../actions';
import { directIntakeAllowsMissingPlate } from '../../../domain/settlement/product-kind';

export type IntakeDefaults = {
  receivedAt: string; plate: string; model: string; supplier: string; supplierCode: string;
  term: string; rent: string; deposit: string;
  /** 차에서 온 원장 상품구분 · 렌트구분(기능 ledgerKindOf) · 차량가(수수료 밑값) — 차 골라 접수일 때만 */
  product?: string; rentKind?: string; price?: string;
  intakeRequestId?: string;
  sourceProductId?: string; sourceProductVersion?: string; sourceOfferId?: string; sourceSnapshotId?: string;
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
 *                         사람이 넣는 칸은 셋: 고객명 · 영업채널 · 영업담당. 나머지는 「더 넣기」 안에 접혀 있다.
 *   blank(신규 접수)     — 차가 없다. 차량 · 고객·영업 · 조건 · 더 넣기 차례로 다 넣는다.
 *   ★하는 일은 기능 쪽 그대로 — 영업채널·담당·공급사를 고르면 원장에 이미 있는 «코드» 를 따라 채운다(지어내지 않는다).
 *   ★필수는 도메인(validateIntake)이 정한다: 차량번호 · 공급사 · 접수일 · 고객명 · 영업채널 · 영업담당.
 */
export default function IntakeForm({ defaults, options, cancelHref, picked, fee, productChoices, ledgerProducts }: {
  defaults: IntakeDefaults; options: IntakeOptions; cancelHref?: string; picked?: boolean;
  /** 차 골라 접수 — 서버가 미리 센 수수료(previewFeeAction 과 같은 셈) */
  fee?: FeePreview | null;
  /**
   * 차 골라 접수에서 상품구분을 «사람이 고를» 말들 — 비었으면 짝이 하나로 떨어진 것(숨은 칸으로 간다).
   * ★원장 상품구분이 수수료 갈래를 정한다(기능 ledgerKindOf).
   * 상품 리스트의 신차렌트는 선출고로 확정된다. 견적출고/신차발주는 직접접수에서만 고른다.
   */
  productChoices?: string[];
  /** 원장 상품구분 전부(기능 LEDGER_PRODUCTS) — 직접 접수의 고를 말 */
  ledgerProducts?: readonly string[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createIntakeAction, { errors: [] });
  const [channel, setChannel] = useState('');
  const [channelCode, setChannelCode] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [supplierCode, setSupplierCode] = useState(defaults.supplierCode);
  const [directProduct, setDirectProduct] = useState(defaults.product ?? '');
  const [delivered, setDelivered] = useState(false);
  /*
   * ★수수료 미리보기 — 「이미 기간에 따라서 수수료는 접수할 때도 알아야 하고」(대표 2026-09-18)
   *   직접 접수는 차 · 상품구분 · 기간 · 대여료 · 차량가가 바뀔 때마다 기능 쪽 previewFeeAction(저장 때와 같은 셈)을 부른다.
   */
  const [미리, set미리] = useState<FeePreview | null>(fee ?? null);
  const 기다림 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const 다시셈 = (form: HTMLFormElement) => {
    if (기다림.current) clearTimeout(기다림.current);
    기다림.current = setTimeout(async () => {
      const all = new FormData(form);
      const fd = new FormData();
      for (const k of ['supplier', 'product', 'model', 'term', 'rent', 'price']) fd.set(k, String(all.get(k) ?? ''));
      if (!String(all.get('supplier') ?? '').trim()) { set미리(null); return; }
      set미리(await previewFeeAction(fd));
    }, 400);
  };
  const 표값 = 미리?.status === 'AUTO' ? 미리 : null;
  /* 수수료 칸 셋 — 비우면 표대로. 표와 다르게 넣으면 사유가 필수(저장 때 도메인이 막는다 — 오류 글 그대로) */
  const 수수료칸 = (
    <>
      <label>청구 수수료<input name="feeClaim" inputMode="numeric" placeholder={표값 ? `표대로 ${표값.claim.toLocaleString('ko-KR')}` : '직접 넣으세요'} /></label>
      <label>지급 수수료<input name="feePay" inputMode="numeric" placeholder={표값 ? `표대로 ${표값.pay.toLocaleString('ko-KR')}` : '직접 넣으세요'} /></label>
      <label className="wide">수수료 사유<input name="feeReason" placeholder={표값 ? '표와 다르게 넣을 때만' : '어떻게 정했는지'} /></label>
    </>
  );
  const 미리글 = !미리 ? <p className="dz-fee-line dz-muted">공급사 · 상품구분 · 기간 · 대여료를 넣으면 수수료가 섭니다.</p>
    : 미리.status === 'AUTO' ? <p className="dz-fee-line">표대로 청구 <b>{미리.claim.toLocaleString('ko-KR')}원</b> · 지급 <b>{미리.pay.toLocaleString('ko-KR')}원</b> <small>{미리.basis} · 비우면 이 값</small></p>
      : <p className="dz-fee-line warn">{미리.why} — 수수료를 직접 넣으세요.</p>;
  /* 표가 못 내면 수수료 칸이 앞에 선다(접혀 있으면 빠뜨린다) */
  const 직접 = !!미리 && 미리.status !== 'AUTO';

  const sel = (name: string, list: string[], label: string, value = '') => (
    <label>{label}
      {/* ★차에서 온 값이 원장 말 목록에 없어도 버리지 않는다(예: 차 「신차렌트」 ↔ 원장 「장기렌트」) —
            버리면 빈 값으로 저장돼 카드의 수수료 미리보기와 저장된 수수료가 갈린다 */}
      <select name={name} defaultValue={value}>
        <option value="">—</option>
        {value && !list.includes(value) && <option value={value}>{value}</option>}
        {list.map((v) => <option key={v}>{v}</option>)}
      </select>
    </label>
  );
  const 묶음 = (title: string, children: ReactNode) => <fieldset className="dz-form-group"><legend>{title}</legend>{children}</fieldset>;

  /* 사람이 넣는 셋 — 두 갈래 모두 같은 칸 */
  const 사람 = (
    <>
      <label>고객명 *<input name="customer" required autoComplete="off" /></label>
      <label>영업채널 *<input name="channel" list="dl-channel" value={channel} required autoComplete="off"
        onChange={(e) => { setChannel(e.target.value); setChannelCode(options.channelCode[e.target.value] ?? ''); }} /></label>
      <label>영업담당 *<input name="agent" list="dl-agent" required autoComplete="off"
        onChange={(e) => {
          const a = e.target.value;
          setAgentCode(options.agentCode[a] ?? '');
          if (!channel && options.agentChannel[a]) { setChannel(options.agentChannel[a]); setChannelCode(options.channelCode[options.agentChannel[a]] ?? ''); }
        }} /></label>
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
        {!picked && sel('rentKind', options.rentKinds, '렌트구분')}
        {sel('contractType', options.contractTypes, '계약방식')}
        {sel('payKind', options.payKinds, '분납여부')}
        {picked && 코드}
        {picked && !직접 && 수수료칸}
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
      onChange={(e) => { if (['supplier', 'product', 'model', 'term', 'rent', 'price'].includes((e.target as unknown as HTMLInputElement).name)) 다시셈(e.currentTarget); }}
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      <datalist id="dl-channel">{options.channels.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-agent">{options.agents.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-supplier">{options.suppliers.map((v) => <option key={v} value={v} />)}</datalist>

      <input type="hidden" name="intakeRequestId" value={defaults.intakeRequestId ?? ''} />
      {picked ? (
        <>
          {/* 차에서 이미 정해진 것 — 판 위 카드가 보여 준다. 여기는 숨은 칸으로만 간다 */}
          {(['plate', 'model', 'supplier', 'term', 'rent', 'deposit', 'price'] as const).map((k) => (
            <input key={k} type="hidden" name={k} value={defaults[k] ?? ''} />
          ))}
          <input type="hidden" name="supplierCode" value={supplierCode} />
          <input type="hidden" name="rentKind" value={defaults.rentKind ?? ''} />
          <input type="hidden" name="sourceProductId" value={defaults.sourceProductId ?? ''} />
          <input type="hidden" name="sourceProductVersion" value={defaults.sourceProductVersion ?? ''} />
          <input type="hidden" name="sourceOfferId" value={defaults.sourceOfferId ?? ''} />
          <input type="hidden" name="sourceSnapshotId" value={defaults.sourceSnapshotId ?? ''} />
          {/* 상품구분 — 짝이 하나면 숨은 칸 · 아니면 사람이 고른다(수수료 갈래가 갈린다) */}
          {productChoices?.length
            ? 묶음('상품구분 — 골라 주세요', (
              <div className="dz-choice" role="radiogroup" aria-label="상품구분">
                {productChoices.map((c) => (
                  <label key={c}><input type="radio" name="product" value={c} defaultChecked={c === defaults.product} required /><span>{c}</span></label>
                ))}
              </div>
            ))
            : <input type="hidden" name="product" value={defaults.product ?? ''} />}
          {/* 고른 상품구분의 수수료 — 표가 내면 여기 한 줄, 못 내면 아래 「수수료 — 직접 넣으세요」가 선다(두 번 안 쓴다) */}
          {productChoices?.length && !직접 ? 미리글 : null}
          {묶음('고객 · 영업', <div className="dz-form-grid">{사람}</div>)}
          {직접 && 묶음('수수료 — 직접 넣으세요', <>{미리글}<div className="dz-form-grid">{수수료칸}</div></>)}
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
                onChange={(e) => setSupplierCode(options.supplierCode[e.target.value] ?? supplierCode)} /></label>
              <label>공급사코드<input name="supplierCode" value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} /></label>
            </div>
          ))}
          {묶음('고객 · 영업', <div className="dz-form-grid">{사람}{코드}</div>)}
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
              <label>렌탈료<input name="rent" defaultValue={defaults.rent} inputMode="numeric" /></label>
              <label>보증금<input name="deposit" defaultValue={defaults.deposit} inputMode="numeric" /></label>
              <label>차량가액 (신차만)<input name="price" inputMode="numeric" /></label>
            </div>
          ))}
          {묶음('수수료', <>{미리글}<div className="dz-form-grid">{수수료칸}</div></>)}
        </>
      )}
      {더}

      {/* 하단바 규격(dz-bar) — 판 바닥. 신규 접수 중에는 [취소] [접수 저장] (대표 2026-09-18) */}
      <div className="dz-bar">
        {state.errors.length > 0 && <ul className="dz-errs">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="dz-bar-go">
          {cancelHref && <a className="dz-bar-sub" href={cancelHref}>취소</a>}
          <button type="submit" className="primary" disabled={pending} aria-busy={pending}>{pending ? '저장 중…' : '접수 저장'}</button>
        </div>
      </div>
    </form>
  );
}
