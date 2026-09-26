'use client';

import { startTransition, useActionState } from 'react';
import { progressAction, type FormState } from '../actions';
import { progressFormId } from '../progress-form-id';

/**
 * 접수 상세의 실제 관측 사실.
 * F04 운영 습관과 맞춰 YES/NO 사실은 체크박스로 보이고, 날짜/사유가 필요한 값은 곁 입력으로 둔다.
 * 규칙 자체(인도일 필수, 계약금 이후 취소 경계 등)는 서버 domain이 다시 검증한다.
 */
export default function Progress({ code, plate, paper, delivered, deliveredAt, cancelled, today, disabled = false }: {
  code: string; plate: string; paper: boolean; delivered: boolean; deliveredAt: string; cancelled: boolean; today: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(progressAction, { errors: [] });

  const send = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (btn?.dataset.confirm && !window.confirm(btn.dataset.confirm)) return;
    if (btn?.name) fd.set(btn.name, btn.value);
    startTransition(() => action(fd));
  };

  const toggle = (e: React.ChangeEvent<HTMLInputElement>, confirmOff?: string) => {
    const form = e.currentTarget.form;
    if (!form) return;
    const on = e.currentTarget.checked;
    if (!on && confirmOff && !window.confirm(confirmOff)) return;
    const fd = new FormData(form);
    fd.set('on', on ? '1' : '0');
    startTransition(() => action(fd));
  };

  const locked = pending || cancelled || disabled;

  return (
    <div className="fn-box dz-progress-facts">
      <form id={progressFormId(code, 'plate')} onSubmit={send} className="dz-progress-row" aria-busy={pending}>
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="kind" value="plate" />
        <label className="dz-progress-field">
          <span>차량번호</span>
          <input name="plate" defaultValue={plate} placeholder="배정 후 입력" disabled={locked} />
        </label>
        <button type="submit" disabled={locked}>저장</button>
      </form>

      <form id={progressFormId(code, 'paper')} onSubmit={send} className="dz-progress-row" aria-busy={pending}>
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="kind" value="paper" />
        <label className="dz-status-check">
          <input type="checkbox" checked={paper} onChange={(e) => toggle(e)} disabled={locked} />
          <span>계약서</span>
          <strong>{paper ? '완료' : '미완료'}</strong>
        </label>
      </form>

      <form id={progressFormId(code, 'delivered')} onSubmit={send} className="dz-progress-row" aria-busy={pending}>
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="kind" value="delivered" />
        <label className="dz-status-check">
          <input type="checkbox" checked={delivered}
            onChange={(e) => toggle(e, '인도 완료 상태를 되돌릴까요? 정산·실적 상태에 영향을 줄 수 있습니다.')}
            disabled={locked} />
          <span>인도완료</span>
          <strong>{delivered ? '완료' : '대기'}</strong>
        </label>
        <label className="dz-progress-field">
          <span>인도일</span>
          <input type="date" name="deliveredAt" defaultValue={deliveredAt || today} disabled={locked} />
        </label>
        {delivered && <button type="submit" name="on" value="1" disabled={locked}>인도일 저장</button>}
      </form>

      <form id={progressFormId(code, 'cancelled')} onSubmit={send} className="dz-progress-row dz-progress-cancel" aria-busy={pending}>
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="kind" value="cancelled" />
        {cancelled ? (
          <>
            <span className="dz-status-text">✓ 접수취소</span>
            <button name="on" value="0" disabled={pending || disabled}>취소 풀기</button>
          </>
        ) : (
          <>
            <label className="dz-progress-field">
              <span>접수취소 사유</span>
              <input name="reason" placeholder="사유를 입력" disabled={pending || disabled} />
            </label>
            <button name="on" value="1" className="dz-action-danger"
              data-confirm="이 접수를 취소할까요? 계약금 수납 이후에는 계약취소 절차가 적용됩니다."
              disabled={pending || disabled}>접수 취소</button>
          </>
        )}
      </form>

      {state.errors.length > 0 && <ul className="dz-errs" role="alert" aria-live="assertive">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {pending && <p className="fn-muted">저장 중…</p>}
    </div>
  );
}
