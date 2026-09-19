'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ActionBar } from '../_design/Primitives';
import {
  approveEsignAction, issueEsignAction, rejectEsignAction, revokeEsignAction, type EsignActionState,
} from './actions';

const init: EsignActionState = {};

function Result({ state }: { state: EsignActionState }) {
  if (state.error) return <p className="dz-warn">{state.error}</p>;
  if (!state.ok && !state.url) return null;
  return <div className="dz-esign-result">
    {state.ok && <p className="dz-ok">{state.ok}</p>}
    {state.url && <div className="dz-esign-link"><input readOnly value={state.url}/><button type="button" onClick={() => navigator.clipboard.writeText(state.url || '')}>복사</button></div>}
  </div>;
}

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export function EsignAdminActions({ contractId, status, publicUrl, documentUrl, listHref }: {
  contractId: string;
  status: string;
  publicUrl?: string;
  documentUrl?: string;
  listHref: string;
}) {
  const previewUrl = '/api/esign/preview/' + encodeURIComponent(contractId);
  const id = safeId(contractId);
  const issueId = 'esign-issue-' + id;
  const revokeId = 'esign-revoke-' + id;
  const approveId = 'esign-approve-' + id;

  const [issued, issue, issuing] = useActionState(issueEsignAction, init);
  const [revoked, revoke, revoking] = useActionState(revokeEsignAction, init);
  const [rejected, reject, rejecting] = useActionState(rejectEsignAction, init);
  const [approved, approve, approving] = useActionState(approveEsignAction, init);

  if (status === 'signed') return <div className="dz-esign-actions">
    <ActionBar>
      <Link className="dz-bar-sub" href={listHref}>목록</Link>
      {documentUrl && <a className="primary" href={documentUrl} target="_blank" rel="noreferrer">완료 계약서</a>}
    </ActionBar>
  </div>;

  if (status === 'pending_review') return <div className="dz-esign-actions">
    <a className="dz-esign-inline-action" href={previewUrl} target="_blank" rel="noreferrer">계약서 미리보기</a>
    <form action={reject} className="dz-esign-reject">
      <input type="hidden" name="contractId" value={contractId}/>
      <input name="items" placeholder="보완항목 예: identity,documents"/>
      <textarea name="reason" placeholder="보완 사유" required/>
      <button className="dz-bar-sub" disabled={rejecting}>보완요청</button>
    </form>
    <form id={approveId} action={approve}><input type="hidden" name="contractId" value={contractId}/></form>
    <Result state={approved}/><Result state={rejected}/>
    <ActionBar>
      <Link className="dz-bar-sub" href={listHref}>목록</Link>
      <button type="submit" form={approveId} className="primary" disabled={approving}>승인·봉인</button>
    </ActionBar>
  </div>;

  if (['sent','opened','in_progress','rejected'].includes(status)) return <div className="dz-esign-actions">
    <a className="dz-esign-inline-action" href={previewUrl} target="_blank" rel="noreferrer">계약서 미리보기</a>
    {publicUrl && <div className="dz-esign-link">
      <input readOnly value={publicUrl}/>
      <button type="button" onClick={() => navigator.clipboard.writeText(publicUrl)}>복사</button>
    </div>}
    <div className="dz-esign-inline-row">
      <form id={issueId} action={issue}><input type="hidden" name="contractId" value={contractId}/><button className="dz-bar-sub" disabled={issuing}>새 링크 발행</button></form>
      <form id={revokeId} action={revoke}><input type="hidden" name="contractId" value={contractId}/><button className="dz-bar-sub" disabled={revoking}>링크 해지</button></form>
    </div>
    <Result state={issued}/><Result state={revoked}/>
    <ActionBar>
      <Link className="dz-bar-sub" href={listHref}>목록</Link>
      {publicUrl
        ? <button type="button" className="primary" onClick={() => navigator.clipboard.writeText(publicUrl)}>고객 링크 복사</button>
        : <button type="submit" form={issueId} className="primary" disabled={issuing}>고객 링크 발행</button>}
    </ActionBar>
  </div>;

  return <div className="dz-esign-actions">
    <a className="dz-esign-inline-action" href={previewUrl} target="_blank" rel="noreferrer">계약서 미리보기</a>
    <form id={issueId} action={issue}><input type="hidden" name="contractId" value={contractId}/></form>
    <Result state={issued}/>
    <ActionBar>
      <Link className="dz-bar-sub" href={listHref}>목록</Link>
      <button type="submit" form={issueId} className="primary" disabled={issuing}>고객 링크 발행</button>
    </ActionBar>
  </div>;
}
