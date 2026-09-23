'use client';
/**
 * 접수 처리 — 차량번호 · 계약서 · 인도 · 취소 (규격 erp-form-grid · erp-field · erp-btn 그대로)
 *   하는 일은 기능 쪽 progressAction 그대로다 — 규칙(인도일 필수 · 취소 사유 필수)은 서버가 다시 본다.
 *   폼 id 는 기능 쪽 progressFormId 를 써서 머리의 주 단추(form=)가 같은 폼을 보낸다.
 */
import { startTransition, useActionState } from 'react';
import { progressAction, type FormState } from '../intake/actions';
import { progressFormId } from '../intake/progress-form-id';

export function IntakeProgress({ code, plate, paper, delivered, deliveredAt, cancelled, today, writable }: {
  code: string; plate: string; paper: boolean; delivered: boolean; deliveredAt: string; cancelled: boolean; today: string; writable: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(progressAction, { errors: [] });
  const send = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (btn?.name) fd.set(btn.name, btn.value);
    startTransition(() => action(fd));
  };
  const off = pending || cancelled;
  return (
    <div>
      {!writable && <p className="erp-field-error">ERP5 쓰기가 꺼져 있어 눌러도 저장되지 않습니다.</p>}
      <form id={progressFormId(code, 'plate')} onSubmit={send} className="erp-inline-form" aria-busy={pending}>
        <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value="plate" />
        <label className="erp-field"><span className="erp-label">차량번호</span>
          <input className="erp-input" name="plate" defaultValue={plate} placeholder="배정 후 입력" disabled={off} /></label>
        <button className="erp-btn" type="submit" disabled={off}>저장</button>
      </form>
      <form id={progressFormId(code, 'paper')} onSubmit={send} className="erp-inline-form" aria-busy={pending}>
        <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value="paper" />
        <div className="erp-field"><span className="erp-label">계약서</span>
          <span><span className={`erp-badge erp-badge--${paper ? 'ok' : 'neutral'}`}>{paper ? '받음' : '안 받음'}</span></span></div>
        <button className="erp-btn" name="on" value={paper ? '0' : '1'} disabled={off}>{paper ? '받음 해제' : '받음으로'}</button>
      </form>
      <form id={progressFormId(code, 'delivered')} onSubmit={send} className="erp-inline-form" aria-busy={pending}>
        <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value="delivered" />
        <label className="erp-field"><span className="erp-label">인도일 {delivered ? <span className="erp-badge erp-badge--ok">인도 완료</span> : null}</span>
          <input className="erp-input" type="date" name="deliveredAt" defaultValue={deliveredAt || today} disabled={off} /></label>
        <button className="erp-btn" name="on" value="1" disabled={off}>{delivered ? '인도일 고침' : '인도 완료'}</button>
        {delivered && <button className="erp-btn erp-btn--ghost" name="on" value="0" disabled={off}>되돌림</button>}
      </form>
      <form id={progressFormId(code, 'cancelled')} onSubmit={send} className="erp-inline-form" aria-busy={pending}>
        <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value="cancelled" />
        {cancelled
          ? <><div className="erp-field"><span className="erp-label">취소</span><span><span className="erp-badge erp-badge--err">취소됨</span></span></div>
            <button className="erp-btn" name="on" value="0" disabled={pending}>취소 풀기</button></>
          : <><label className="erp-field"><span className="erp-label">취소 사유</span><input className="erp-input" name="reason" disabled={pending} /></label>
            <button className="erp-btn erp-btn--danger-text" name="on" value="1" disabled={pending}>계약 취소</button></>}
      </form>
      {state.errors.length > 0 && <ul className="erp-field-error">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {pending && <p className="erp-muted">저장 중…</p>}
    </div>
  );
}
