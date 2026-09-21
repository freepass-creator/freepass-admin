'use client';
/**
 * ★정산 걸음 · 발행 — 폼만 여기 있다. **누르는 주 단추는 판 하단바에 있다**(§14-3 — `form=` 로 이 폼을 보낸다).
 *   셈 · 막는 규칙 · 순서는 전부 기능 쪽(lifecycle.ts · lifecycleAction · issueInvoiceAction) — 오류 글은 받은 그대로 보인다.
 *   ⚠ 운영 원장(ERP5)에 바로 쓴다. 모양 확인 때 누르지 않는다.
 */
import { startTransition, useActionState, useState } from 'react';
import { createClaimLinkAction, issueInvoiceAction, lifecycleAction, revokeClaimLinkAction, type FormState } from '../intake/actions';
import { Notice } from '../_design/Primitives';

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
  const [s, act, pending] = useActionState<FormState & { invoiceNo?: string }, FormData>(issueInvoiceAction, { errors: [] });
  return (
    <form id={id} onSubmit={보냄(act)} aria-busy={pending}>
      <input type="hidden" name="month" value={month} /><input type="hidden" name="axis" value={axis} /><input type="hidden" name="party" value={party} />
      {s.invoiceNo && <Notice tone="ok">발행했습니다 — {s.invoiceNo}</Notice>}
      {오류(s)}
    </form>
  );
}

/**
 * 한 줄의 주 걸음 — 하단바 주 단추가 보내는 폼. need 에 따라 칸이 선다:
 *   none(확인 · 정정 풂) · money(수금 · 지급 — 금액 · 날) · correct(정정 — 금액 · 사유 필수)
 */
export function LifeForm({ id, code, kind, axis, need, amount, day, operationId }: {
  id: string; code: string; kind: string; axis: '공급사' | '영업채널';
  need: 'none' | 'money' | 'correct'; amount?: number | null; day?: string; operationId?: string;
}) {
  const [s, act, pending] = useActionState<FormState, FormData>(lifecycleAction, { errors: [] });
  return (
    <form id={id} className={need === 'none' ? '' : 'dz-life-form'} onSubmit={보냄(act)} aria-busy={pending}>
      <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="axis" value={axis} />
      {operationId && <input type="hidden" name="operationId" value={operationId} />}
      {need === 'money' && <>
        <label>{kind === 'collected' ? '받은 금액' : '준 금액'}<input name="amount" defaultValue={amount ?? ''} inputMode="numeric" /></label>
        <label>{kind === 'collected' ? '받은 날' : '준 날'}<input name="day" type="date" defaultValue={day} /></label>
        {typeof amount === 'number' && <small className="dz-muted wide">남은 금액 {Math.round(amount).toLocaleString('ko-KR')}원 전액이 기본값입니다. 부분 처리면 금액만 줄여 입력합니다.</small>}
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
export function SideStep({ id, code, kind, label, on, month, biz, day, externalSubmit = false }: {
  id?: string; code: string; kind: 'hold' | 'billMonth' | 'invoice'; label: string;
  on?: boolean; month?: string; biz?: string; day?: string; externalSubmit?: boolean;
}) {
  const [s, act, pending] = useActionState<FormState, FormData>(lifecycleAction, { errors: [] });
  return (
    <form id={id} className="dz-side-step" onSubmit={보냄(act)} aria-busy={pending}>
      <input type="hidden" name="code" value={code} /><input type="hidden" name="kind" value={kind} />
      <b>{label}</b>
      {kind === 'billMonth' && <input name="month" type="month" defaultValue={month} aria-label="청구월" disabled={pending} />}
      {kind === 'invoice' && !on && <>
        <input name="day" type="date" defaultValue={day} aria-label="계산서 날짜" disabled={pending} />
        <input name="biz" defaultValue={biz} placeholder="사업자번호 10자리" aria-label="사업자번호" inputMode="numeric" disabled={pending} />
        {externalSubmit && <input type="hidden" name="on" value="1" />}
      </>}
      {!externalSubmit && (kind === 'billMonth'
        ? <button type="submit" disabled={pending} aria-busy={pending}>달 정하기</button>
        : <button type="submit" name="on" value={on ? '0' : '1'} disabled={pending} aria-busy={pending}>{on ? '풀기' : kind === 'hold' ? '보류' : '끊음'}</button>)}
      {오류(s)}
    </form>
  );
}

/**
 * ★청구 링크 — PDF 대신 링크(대표 2026-09-18 「공급사한테 청구서 PDF 말고 이제 그냥 청구 링크를 보내자 · 사업자등록번호 넣으면 보이게끔」)
 *   발행된 장에만 선다. 링크 주소는 «만든 그 순간 한 번만» 보인다(서버엔 해시뿐) — 복사 단추. 다시 만들면 옛 링크는 죽는다.
 *   상대가 열어 본 횟수 · 답(확인 · 이의)을 같이 보인다. 하는 일은 기능 쪽 createClaimLinkAction · revokeClaimLinkAction.
 *   ⚠ 운영 원장 — 모양 확인 때 누르지 않는다.
 */
export function ClaimLink({ month, axis, party, live, openCount, openedAt, response }: {
  month: string; axis: '공급사' | '영업채널'; party: string;
  /** 살아 있는 링크가 있나(만든 적 있고 안 거둠) */
  live: boolean; openCount?: number; openedAt?: number;
  response?: { state: '확인' | '이의'; at: number; memo?: string } | null;
}) {
  const [made, make, making] = useActionState<FormState & { url?: string; warn?: string }, FormData>(createClaimLinkAction, { errors: [] });
  const [gone, revoke, revoking] = useActionState<FormState, FormData>(revokeClaimLinkAction, { errors: [] });
  const [copied, setCopied] = useState(false);
  const 날 = (t?: number) => (t ? new Date(t + 9 * 3600_000).toISOString().slice(0, 10) : '');
  const 칸 = (<><input type="hidden" name="month" value={month} /><input type="hidden" name="axis" value={axis} /><input type="hidden" name="party" value={party} /></>);
  return (
    <div className="dz-claim-link">
      <p>
        <b>청구 링크</b>{' '}
        {live ? <span>살아 있음</span> : <span className="dz-muted">없음</span>}
        {openCount ? <span> · 열어봄 {openCount}번{openedAt ? ` (${날(openedAt)})` : ''}</span> : null}
        {response && <span className={response.state === '이의' ? 'dz-warn-txt' : 'dz-ok-txt'}> · {response.state === '확인' ? '확인함' : `이의 — ${response.memo ?? ''}`} ({날(response.at)})</span>}
      </p>
      <div className="dz-claim-link-go">
        <form aria-busy={making} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => make(fd)); }}>
          {칸}<button type="submit" disabled={making} aria-busy={making}>{making ? '만드는 중…' : live ? '새로 만들기(옛 링크 죽음)' : '링크 만들기'}</button>
        </form>
        {live && (
          <form aria-busy={revoking} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => revoke(fd)); }}>
            {칸}<button type="submit" disabled={revoking} aria-busy={revoking}>{revoking ? '거두는 중…' : '거두기'}</button>
          </form>
        )}
      </div>
      {made.url && (
        <div className="dz-claim-url">
          <code>{made.url}</code>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(made.url!); setCopied(true); } catch { /* 막혔다 */ } }}>{copied ? '복사됨' : '복사'}</button>
          <small>이 주소는 지금 한 번만 보입니다 — 잃으면 새로 만듭니다.</small>
        </div>
      )}
      {made.warn && <Notice tone="warn">{made.warn}</Notice>}
      {오류(made)}{오류(gone)}
    </div>
  );
}
