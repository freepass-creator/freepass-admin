'use client';

import Link from 'next/link';
import { startTransition, useActionState, useState, type ReactNode } from 'react';
import { progressAction, type FormState } from './actions';
import type { IntakeNextAction } from './next-action';

/**
 * 접수판 «현재 업무» — 목업 workPanel(다음 업무 카드 · 처리 기준) 그대로, 실제 일은 기능 쪽 progressAction.
 *   맨 위 = 지금 할 한 가지(하단바 주 버튼이 그것을 저장). 드문 일(고침·되돌림·취소)은 「다른 작업」에 접어 둔다.
 *   ★규칙(인도일 필수 · 취소 사유 필수 · 순서)은 서버가 다시 본다 — 여기서 새로 정하지 않는다.
 */
export function IntakeWork({ code, next, plate, paper, delivered, deliveredAt, cancelled, today, settleHref, backHref, readOnly, money, head, intakeCancellationAllowed = true }: {
  code: string; next: IntakeNextAction; plate: string; paper: boolean; delivered: boolean; deliveredAt: string;
  cancelled: boolean; today: string; settleHref: string; readOnly: boolean;
  /** 하단바 왼쪽 [접수 목록] — 오른쪽 판을 목록으로 되돌린다 */
  backHref: string;
  /** 위에 서는 접수 상세(상태 · 진행 사실 · 금액 · 조건 · 이력) — 판이 그려 넘긴다 */
  head?: ReactNode;
  /** 돈 고치기(수수료 · 프로모션 · 가감 · 환수) — 기능 쪽 MoneyForm 들을 판이 넘겨준다 */
  money?: ReactNode;
  intakeCancellationAllowed?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(progressAction, { errors: [] });
  const [보냄, set보냄] = useState(false);
  const send = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (btn?.name) fd.set(btn.name, btn.value);
    set보냄(true);
    startTransition(() => action(fd));
  };
  const 숨은 = (kind: string) => <><input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value={kind} /></>;

  const 카드 = {
    paper: ['계약서 받기', '계약서를 받았으면 받음으로 표시합니다. 전자계약은 「계약」 메뉴에서 보냅니다.'],
    plate: ['차량번호 넣기', '배정된 차량번호를 넣습니다. 신차는 계약 뒤에 번호가 나옵니다.'],
    delivered: ['인도 완료 찍기', '고객에게 차가 넘어간 날을 찍으면 실적이 섭니다.'],
    settlement: ['정산 이어 가기', next.kind === 'settlement' && next.tab === 'pay'
      ? '인도가 끝나 실적이 섰습니다. 영업채널 지급은 정산에서 이어 갑니다.'
      : '인도가 끝나 실적이 섰습니다. 공급사 청구·수금은 정산에서 이어 갑니다.'],
    blocked: [next.kind === 'blocked' ? next.label : '', '원장에서 이 칸을 먼저 채워야 다음 걸음으로 갑니다.'],
    new: [cancelled ? '취소된 접수' : '끝난 접수', cancelled ? '취소된 접수입니다. 되살리려면 「다른 작업」에서 취소를 풉니다.' : '정산까지 마친 접수입니다.'],
  }[next.kind];

  const 주 = (() => {
    /* 조회 전용이면 «저장하는» 걸음만 막는다 — 옮겨 가기(정산으로 · 새 접수)는 그대로 */
    if (readOnly && (next.kind === 'paper' || next.kind === 'plate' || next.kind === 'delivered')) return <button type="button" className="primary" disabled>조회 전용</button>;
    if (next.kind === 'paper') return <button type="submit" form="pb-next" name="on" value="1" className="primary" disabled={pending}>{pending ? '저장 중…' : '계약서 받음'}</button>;
    if (next.kind === 'plate') return <button type="submit" form="pb-next" className="primary" disabled={pending}>{pending ? '저장 중…' : '차량번호 저장'}</button>;
    if (next.kind === 'delivered') return <button type="submit" form="pb-next" name="on" value="1" className="primary" disabled={pending}>{pending ? '저장 중…' : '인도 완료'}</button>;
    if (next.kind === 'settlement') return <Link className="primary" href={settleHref}>정산으로</Link>;
    if (next.kind === 'blocked') return <button type="button" className="primary" disabled>다음 · {next.label}</button>;
    return <Link className="primary" href="/products">+ 새 접수</Link>;
  })();

  return (
    <>
      <div className="web-scroll">
        {head}
        <div className="identity">
          <span className={`tag${next.kind === 'new' ? '' : ' warn'}`}>다음 업무</span>
          <h3>{카드[0]}</h3>
          <p>{카드[1]}</p>
        </div>
        {readOnly && <p className="notice warn">ERP5 쓰기가 꺼져 있어 저장되지 않습니다(조회 전용).</p>}
        {보냄 && !pending && state.errors.length === 0 && <p className="notice ok" role="status">저장했습니다.</p>}
        {state.errors.length > 0 && <ul className="pb-errs" role="alert">{state.errors.map((m) => <li key={m}>{m}</li>)}</ul>}

        {(next.kind === 'paper' || next.kind === 'plate' || next.kind === 'delivered') && (
          <form id="pb-next" className="form" onSubmit={send} aria-busy={pending}>
            {숨은(next.kind)}
            {next.kind === 'plate' && <label>차량번호<input name="plate" defaultValue={plate} required placeholder="예: PLATE-EXAMPLE" autoComplete="off" /></label>}
            {next.kind === 'delivered' && <label>인도일<input type="date" name="deliveredAt" defaultValue={deliveredAt || today} required /></label>}
          </form>
        )}

        <details className="more">
          <summary>다른 작업</summary>
          <div className="more-body">
            <form className="tool" onSubmit={send}>
              {숨은('plate')}
              <div className="form"><label>차량번호<input name="plate" defaultValue={plate} placeholder="배정 후 입력" disabled={pending || cancelled || readOnly} /></label></div>
              <button type="submit" className="small-btn" disabled={pending || cancelled || readOnly}>저장</button>
            </form>
            <form className="tool" onSubmit={send}>
              {숨은('paper')}
              <div className="form"><label>계약서<input value={paper ? '받음' : '안 받음'} readOnly tabIndex={-1} /></label></div>
              <button name="on" value={paper ? '0' : '1'} className="small-btn" disabled={pending || cancelled || readOnly}>{paper ? '받음 해제' : '받음으로'}</button>
            </form>
            <form className="tool" onSubmit={send}>
              {숨은('delivered')}
              <div className="form"><label>인도일 {delivered ? '· 완료' : '· 전'}<input type="date" name="deliveredAt" defaultValue={deliveredAt || today} disabled={pending || cancelled || readOnly} /></label></div>
              <span style={{ display: 'flex', gap: 6 }}>
                <button name="on" value="1" className="small-btn" disabled={pending || cancelled || readOnly}>{delivered ? '고침' : '인도 완료'}</button>
                {delivered && <button name="on" value="0" className="small-btn" disabled={pending || cancelled || readOnly}>되돌림</button>}
              </span>
            </form>
            <form className="tool" onSubmit={send}>
              {숨은('cancelled')}
              {cancelled
                ? <><div className="form"><label>취소 해제 사유<input name="reason" placeholder="해제 사유 필수" required disabled={pending || readOnly || !intakeCancellationAllowed} /></label></div>
                    <button name="on" value="0" className="small-btn" disabled={pending || readOnly || !intakeCancellationAllowed}>취소 풀기</button></>
                : <><div className="form"><label>취소 사유<input name="reason" placeholder="취소할 때만 — 사유 필수" disabled={pending || readOnly || !intakeCancellationAllowed} /></label></div>
                    <button name="on" value="1" className="small-btn danger" disabled={pending || readOnly || !intakeCancellationAllowed}>접수 취소</button></>}
            </form>
            {!cancelled && !intakeCancellationAllowed && <p className="notice warn">계약금 수납 후에는 계약취소, 인도 후에는 계약해지로 처리해야 합니다. 접수취소로 되돌리지 않습니다.</p>}
          </div>
        </details>
        {money && (
          <details className="more">
            <summary>돈 고치기 · 환수</summary>
            <fieldset className="more-body form pb-money" disabled={readOnly}>{money}</fieldset>
          </details>
        )}
      </div>
      <div className="web-actions">
        <Link className="tertiary" href={backHref}>접수 목록</Link>
        {주}
      </div>
    </>
  );
}
