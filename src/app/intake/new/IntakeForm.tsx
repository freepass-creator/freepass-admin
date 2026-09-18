'use client';

import { startTransition, useActionState, useState } from 'react';
import { createIntakeAction, type FormState } from '../actions';

export type IntakeDefaults = {
  receivedAt: string; plate: string; model: string; supplier: string; supplierCode: string;
  term: string; rent: string; deposit: string;
};
export type IntakeOptions = {
  channels: string[]; channelCode: Record<string, string>;
  agents: string[]; agentCode: Record<string, string>; agentChannel: Record<string, string>;
  suppliers: string[]; supplierCode: Record<string, string>;
  products: string[]; rentKinds: string[]; contractTypes: string[]; payKinds: string[];
};

/**
 * 접수 입력. ★모양은 신경 쓰지 않는다 (대표 2026-09-18). 하는 일만 —
 *   영업채널·담당·공급사를 고르면 원장에 이미 있는 «코드» 를 따라 채운다(지어내지 않는다).
 */
export default function IntakeForm({ defaults, options }: { defaults: IntakeDefaults; options: IntakeOptions }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createIntakeAction, { errors: [] });
  const [channel, setChannel] = useState('');
  const [channelCode, setChannelCode] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [supplierCode, setSupplierCode] = useState(defaults.supplierCode);
  const [delivered, setDelivered] = useState(false);

  const sel = (name: string, list: string[], label: string) => (
    <label>{label}
      <select name={name} defaultValue="">
        <option value="">—</option>{list.map((v) => <option key={v}>{v}</option>)}
      </select>
    </label>
  );

  return (
    /* ★`action=` 로 넘기면 React 19 가 제출 뒤 입력칸을 비운다 — 틀려서 되돌아와도 쓴 것이 다 날아간다.
         그래서 손으로 넘긴다. */
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}
      className="fn-box" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
      <datalist id="dl-channel">{options.channels.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-agent">{options.agents.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-supplier">{options.suppliers.map((v) => <option key={v} value={v} />)}</datalist>

      <label>접수일 *<input name="receivedAt" type="date" defaultValue={defaults.receivedAt} required /></label>
      <label>차량번호 *<input name="plate" defaultValue={defaults.plate} required /></label>
      <label>모델<input name="model" defaultValue={defaults.model} /></label>
      <label>고객명 *<input name="customer" required /></label>

      <label>영업채널 *<input name="channel" list="dl-channel" value={channel} required
        onChange={(e) => { setChannel(e.target.value); setChannelCode(options.channelCode[e.target.value] ?? ''); }} /></label>
      <label>채널코드<input name="channelCode" value={channelCode} onChange={(e) => setChannelCode(e.target.value)} /></label>
      <label>영업담당 *<input name="agent" list="dl-agent" required
        onChange={(e) => {
          const a = e.target.value;
          setAgentCode(options.agentCode[a] ?? '');
          if (!channel && options.agentChannel[a]) { setChannel(options.agentChannel[a]); setChannelCode(options.channelCode[options.agentChannel[a]] ?? ''); }
        }} /></label>
      <label>영업자코드<input name="agentCode" value={agentCode} onChange={(e) => setAgentCode(e.target.value)} /></label>

      <label>공급사 *<input name="supplier" list="dl-supplier" defaultValue={defaults.supplier} required
        onChange={(e) => setSupplierCode(options.supplierCode[e.target.value] ?? supplierCode)} /></label>
      <label>공급사코드<input name="supplierCode" value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} /></label>
      {sel('product', options.products, '상품구분')}
      {sel('rentKind', options.rentKinds, '렌트구분')}

      {sel('contractType', options.contractTypes, '계약방식')}
      {sel('payKind', options.payKinds, '분납여부')}
      <label>계약기간(개월)<input name="term" defaultValue={defaults.term} inputMode="numeric" /></label>
      <label>렌탈료<input name="rent" defaultValue={defaults.rent} inputMode="numeric" /></label>
      <label>보증금<input name="deposit" defaultValue={defaults.deposit} inputMode="numeric" /></label>
      <label>차량가액 (신차만)<input name="price" inputMode="numeric" /></label>

      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><input type="checkbox" name="paper" /> 계약서 받음</label>
      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><input type="checkbox" name="delivered" checked={delivered} onChange={(e) => setDelivered(e.target.checked)} /> 인도 완료</label>
      {delivered && <label>인도일 *<input name="deliveredAt" type="date" required /></label>}
      <label style={{ gridColumn: '1 / -1' }}>메모<textarea name="note" rows={2} /></label>

      <div style={{ gridColumn: '1 / -1' }}>
        {state.errors.length > 0 && <ul className="fn-err">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <button type="submit" disabled={pending}>{pending ? '저장 중…' : '접수 저장'}</button>
      </div>
    </form>
  );
}
