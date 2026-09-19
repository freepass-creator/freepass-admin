'use client';

import { useActionState } from 'react';
import { createEsignContractAction, type EsignActionState } from '../actions';

export type EsignFormDefaults = {
  settlementRowId?: string;
  returnTo?: string;
  customerName?: string;
  customerPhone?: string;
  customerType?: '개인' | '개인사업자' | '법인';
  contractDate?: string;
  vehicleName?: string;
  plate?: string;
  supplierCode?: string;
  supplierName?: string;
  termMonths?: string;
  rent?: string;
  deposit?: string;
  contractKind?: 'rent_return' | 'rent_buyout' | 'sub_return' | 'sub_buyout';
  insuranceSide?: '회사포함' | '고객직접';
};

export function CreateEsignForm({ defaults = {}, cancelHref = '/esign' }: {
  defaults?: EsignFormDefaults;
  cancelHref?: string;
}) {
  const [state, action, pending] = useActionState<EsignActionState, FormData>(createEsignContractAction, {});
  return <form action={action} className="dz-esign-create" aria-busy={pending}>
    {defaults.settlementRowId && <input type="hidden" name="settlementRowId" value={defaults.settlementRowId}/>}
    {defaults.returnTo && <input type="hidden" name="returnTo" value={defaults.returnTo}/>}
    {state.error && <p className="dz-warn">{state.error}</p>}
    <fieldset className="dz-form-group"><legend>고객</legend><div className="dz-form-grid">
      <label>고객명 *<input name="customerName" defaultValue={defaults.customerName ?? ''} required/></label>
      <label>연락처 *<input name="customerPhone" defaultValue={defaults.customerPhone ?? ''} inputMode="tel" required/></label>
      <label>고객유형<select name="customerType" defaultValue={defaults.customerType ?? '개인'}><option>개인</option><option>개인사업자</option><option>법인</option></select></label>
      <label>계약일 *<input name="contractDate" defaultValue={defaults.contractDate ?? ''} type="date" required/></label>
    </div></fieldset>
    <fieldset className="dz-form-group"><legend>차량 · 공급사</legend><div className="dz-form-grid">
      <label>차명 *<input name="vehicleName" defaultValue={defaults.vehicleName ?? ''} required/></label>
      <label>차량번호 *<input name="plate" defaultValue={defaults.plate ?? ''} placeholder="신차면 미정" required/></label>
      <label>공급사코드 *<input name="supplierCode" defaultValue={defaults.supplierCode ?? ''} required/></label>
      <label>공급사명<input name="supplierName" defaultValue={defaults.supplierName ?? ''}/></label>
    </div></fieldset>
    <fieldset className="dz-form-group"><legend>계약조건</legend><div className="dz-form-grid">
      <label>기간(개월) *<input name="termMonths" defaultValue={defaults.termMonths ?? ''} inputMode="numeric" required/></label>
      <label>월 대여료 *<input name="rent" defaultValue={defaults.rent ?? ''} inputMode="numeric" required/></label>
      <label>보증금 *<input name="deposit" defaultValue={defaults.deposit ?? ''} inputMode="numeric" placeholder="없으면 0" required/></label>
      <label>계약유형<select name="contractKind" defaultValue={defaults.contractKind ?? 'rent_return'}><option value="rent_return">렌탈 반납형</option><option value="rent_buyout">렌탈 인수형</option><option value="sub_return">구독 반납형</option><option value="sub_buyout">구독 인수형</option></select></label>
      <label>보험<select name="insuranceSide" defaultValue={defaults.insuranceSide ?? '회사포함'}><option>회사포함</option><option>고객직접</option></select></label>
    </div></fieldset>
    <div className="dz-bar"><div className="dz-bar-go"><a className="dz-bar-sub" href={cancelHref}>취소</a><button className="primary" disabled={pending}>{pending?'만드는 중…':'계약 저장'}</button></div></div>
  </form>;
}
