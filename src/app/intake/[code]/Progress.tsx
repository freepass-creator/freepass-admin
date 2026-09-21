'use client';

import { startTransition, useActionState } from 'react';
import { progressAction, type FormState } from '../actions';
import { progressFormId } from '../progress-form-id';

/** 계약서 · 인도 · 취소 — 누르면 원장에 바로 쓴다. ★규칙(인도일 필수 · 취소 사유 필수)은 서버가 다시 본다. */
export default function Progress({ code, plate, paper, delivered, deliveredAt, cancelled, today }: {
  code: string; plate: string; paper: boolean; delivered: boolean; deliveredAt: string; cancelled: boolean; today: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(progressAction, { errors: [] });
  const send = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (btn?.name) fd.set(btn.name, btn.value);
    startTransition(() => action(fd));
  };

  return (
    <div className="fn-box">
      <form id={progressFormId(code, 'plate')} onSubmit={send} className="dz-progress-row" aria-busy={pending}>
        <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value="plate" />
        차량번호 <input name="plate" defaultValue={plate} placeholder="배정 후 입력" disabled={pending || cancelled} />{' '}
        <button type="submit" disabled={pending || cancelled}>차량번호 저장</button>
      </form>
      <form id={progressFormId(code, 'paper')} onSubmit={send} className="dz-progress-row" aria-busy={pending}>
        <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value="paper" />
        계약서 {paper ? '● 받음' : '○ 안 받음'}{' '}
        <button name="on" value={paper ? '0' : '1'} disabled={pending || cancelled}>{paper ? '받음 해제' : '받음으로'}</button>
      </form>
      <form id={progressFormId(code, 'delivered')} onSubmit={send} className="dz-progress-row" aria-busy={pending}>
        <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value="delivered" />
        인도 {delivered ? `● 완료 (${deliveredAt || '인도일 없음'})` : '○ 전'}{' '}
        <input type="date" name="deliveredAt" defaultValue={deliveredAt || today} disabled={pending || cancelled} />{' '}
        <button name="on" value="1" disabled={pending || cancelled}>{delivered ? '인도일 고침' : '인도 완료'}</button>{' '}
        {delivered && <button name="on" value="0" disabled={pending || cancelled}>인도 되돌림</button>}
      </form>
      <form id={progressFormId(code, 'cancelled')} onSubmit={send} aria-busy={pending}>
        <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value="cancelled" />
        {cancelled
          ? <>● 취소됨 <button name="on" value="0" disabled={pending}>취소 풀기</button></>
          : <>취소 사유 <input name="reason" size={30} disabled={pending} /> <button name="on" value="1" disabled={pending}>취소</button></>}
      </form>
      {state.errors.length > 0 && <ul className="fn-err">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {pending && <p className="fn-muted">저장 중…</p>}
    </div>
  );
}
