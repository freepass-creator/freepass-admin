'use client';
/**
 * ★정산 걸음 · 발행 — 폼만 여기 있다. **누르는 주 단추는 판 하단바에 있다**(§14-3 — `form=` 로 이 폼을 보낸다).
 *   셈 · 막는 규칙 · 순서는 전부 기능 쪽(lifecycle.ts · lifecycleAction · issueInvoiceAction) — 오류 글은 받은 그대로 보인다.
 *   ⚠ 운영 원장(ERP5)에 바로 쓴다. 모양 확인 때 누르지 않는다.
 */
import { startTransition, useActionState } from 'react';
import { issueInvoiceAction, lifecycleAction, type FormState } from '../intake/actions';

const 보냄 = (act: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  /* 하단바 단추(form= 로 연결)의 name/value 도 싣는다 */
  const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
  if (btn?.name) fd.set(btn.name, btn.value);
  startTransition(() => act(fd));
};
const 오류 = (s: FormState) => (s.errors.length ? <ul className="dz-errs">{s.errors.map((x) => <li key={x}>{x}</li>)}</ul> : null);

/** 발행 — 한 달 · 한 축 · 한 상대. 칸은 숨은 셋뿐, 단추는 하단바 */
export function IssueForm({ id, month, axis, party }: { id: string; month: string; axis: '공급사' | '영업채널'; party: string }) {
  const [s, act] = useActionState<FormState & { invoiceNo?: string }, FormData>(issueInvoiceAction, { errors: [] });
  return (
    <form id={id} onSubmit={보냄(act)}>
      <input type="hidden" name="month" value={month} /><input type="hidden" name="axis" value={axis} /><input type="hidden" name="party" value={party} />
      {s.invoiceNo && <p className="dz-ok">발행했습니다 — {s.invoiceNo}</p>}
      {오류(s)}
    </form>
  );
}

/**
 * 한 줄의 주 걸음 — 하단바 주 단추가 보내는 폼. need 에 따라 칸이 선다:
 *   none(확인 · 정정 풂) · money(수금 · 지급 — 금액 · 날) · correct(정정 — 금액 · 사유 필수)
 */
export function LifeForm({ id, code, kind, axis, need, amount, day }: {
  id: string; code: string; kind: string; axis: '공급사' | '영업채널';
  need: 'none' | 'money' | 'correct'; amount?: number | null; day?: string;
}) {
  const [s, act] = useActionState<FormState, FormData>(lifecycleAction, { errors: [] });
  return (
    <form id={id} className={need === 'none' ? '' : 'dz-life-form'} onSubmit={보냄(act)}>
      <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="axis" value={axis} />
      {need === 'money' && <>
        <label>{kind === 'collected' ? '받은 금액' : '준 금액'}<input name="amount" defaultValue={amount ?? ''} inputMode="numeric" /></label>
        <label>{kind === 'collected' ? '받은 날' : '준 날'}<input name="day" type="date" defaultValue={day} /></label>
      </>}
      {need === 'correct' && <>
        <label>상대가 말한 금액<input name="amount" inputMode="numeric" placeholder="모르면 비움" /></label>
        <label className="wide">사유 *<input name="memo" placeholder="상대가 뭐라고 했는지" /></label>
      </>}
      {오류(s)}
    </form>
  );
}

/** 곁 걸음 — 본문 안 작은 폼(청구 보류 · 청구월 정하기 · 계산서). 제 단추를 가진다(주 걸음이 아니라서 하단바에 안 올린다) */
export function SideStep({ code, kind, label, on, month, biz, day }: {
  code: string; kind: 'hold' | 'billMonth' | 'invoice'; label: string;
  on?: boolean; month?: string; biz?: string; day?: string;
}) {
  const [s, act] = useActionState<FormState, FormData>(lifecycleAction, { errors: [] });
  return (
    <form className="dz-side-step" onSubmit={보냄(act)}>
      <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value={kind} />
      <b>{label}</b>
      {kind === 'billMonth' && <input name="month" type="month" defaultValue={month} aria-label="청구월" />}
      {kind === 'invoice' && !on && <>
        <input name="day" type="date" defaultValue={day} aria-label="계산서 날짜" />
        <input name="biz" defaultValue={biz} placeholder="사업자번호" aria-label="사업자번호" />
      </>}
      {kind === 'billMonth'
        ? <button type="submit">달 정하기</button>
        : <button type="submit" name="on" value={on ? '0' : '1'}>{on ? '풀기' : kind === 'hold' ? '보류' : '끊음'}</button>}
      {오류(s)}
    </form>
  );
}
