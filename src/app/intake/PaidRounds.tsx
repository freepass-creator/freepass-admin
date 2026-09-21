'use client';
/**
 * 받은 회차 — 분납이 «끊겼을 때» 멈춘 회차를 사람이 적는다 (기능 세션 2026-09-18 · 대표 「인도는 사람이 찍는다 · 완납은 기계가 따진다」)
 *   비우면 기간으로 판정한다(stage.ts paidRoundsOf). 적혀 있어야 기계가 「끊겼다」고 말할 수 있다.
 *   ★분납 · 인도된 줄에서만 선다. 오류 문구는 받은 그대로.
 *   ⚠ 저장은 운영 원장(ERP5)에 바로 쓴다.
 */
import { startTransition, useActionState } from 'react';
import { progressAction, type FormState } from './actions';

export function PaidRounds({ code, rounds, paid, disabled }: { code: string; rounds: number; paid: number | null; disabled?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(progressAction, { errors: [] });
  return (
    <div className="dz-money">
      <form aria-busy={pending} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
        <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value="paidRounds" />
        <b>받은 회차 <small className="dz-sec-note inline">{rounds}회 분납 · 끊겼을 때만 적는다 — 비우면 기간으로 판정</small></b>
        <label>받은 회차<input name="rounds" defaultValue={paid ?? ''} inputMode="numeric" placeholder={`0 ~ ${rounds}`} /></label>
        <span />
        {state.errors.length > 0 && <ul className="dz-errs">{state.errors.map((x) => <li key={x}>{x}</li>)}</ul>}
        <button type="submit" disabled={disabled || pending} aria-busy={pending}>{pending ? '저장 중…' : '받은 회차 저장'}</button>
      </form>
    </div>
  );
}
