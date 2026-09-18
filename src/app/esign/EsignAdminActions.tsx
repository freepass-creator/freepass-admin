'use client';

import { useActionState } from 'react';
import {
  approveEsignAction, issueEsignAction, rejectEsignAction, revokeEsignAction, type EsignActionState,
} from './actions';

const init: EsignActionState = {};

function Result({ state }: { state: EsignActionState }) {
  if (state.error) return <p className="dz-warn">{state.error}</p>;
  if (!state.ok && !state.url) return null;
  return <div className="dz-esign-result">{state.ok && <p className="dz-ok">{state.ok}</p>}{state.url && <div className="dz-esign-link"><input readOnly value={state.url}/><button type="button" onClick={() => navigator.clipboard.writeText(state.url || '')}>복사</button></div>}</div>;
}

export function EsignAdminActions({ contractId, status, publicUrl, documentUrl }: {
  contractId: string;
  status: string;
  publicUrl?: string;
  documentUrl?: string;
}) {
  const [issued, issue, issuing] = useActionState(issueEsignAction, init);
  const [revoked, revoke, revoking] = useActionState(revokeEsignAction, init);
  const [rejected, reject, rejecting] = useActionState(rejectEsignAction, init);
  const [approved, approve, approving] = useActionState(approveEsignAction, init);

  if (status === 'signed') return <div className="dz-esign-actions">
    {documentUrl && <a className="primary" href={documentUrl} target="_blank" rel="noreferrer">서명본 열기</a>}
  </div>;

  if (status === 'pending_review') return <div className="dz-esign-actions">
    <form action={approve}><input type="hidden" name="contractId" value={contractId}/><button className="primary" disabled={approving}>승인·봉인</button></form>
    <form action={reject} className="dz-esign-reject"><input type="hidden" name="contractId" value={contractId}/><input name="items" placeholder="보완항목 예: identity,documents"/><textarea name="reason" placeholder="보완 사유" required/><button className="dz-bar-sub" disabled={rejecting}>보완요청</button></form>
    <Result state={approved}/><Result state={rejected}/>
  </div>;

  if (['sent','opened','in_progress','rejected'].includes(status)) return <div className="dz-esign-actions">
    {publicUrl && <div className="dz-esign-link"><input readOnly value={publicUrl}/><button type="button" onClick={() => navigator.clipboard.writeText(publicUrl)}>링크 복사</button></div>}
    <form action={issue}><input type="hidden" name="contractId" value={contractId}/><button className="primary" disabled={issuing}>새 링크 발행</button></form>
    <form action={revoke}><input type="hidden" name="contractId" value={contractId}/><button className="dz-bar-sub" disabled={revoking}>링크 해지</button></form>
    <Result state={issued}/><Result state={revoked}/>
  </div>;

  return <div className="dz-esign-actions">
    <form action={issue}><input type="hidden" name="contractId" value={contractId}/><button className="primary" disabled={issuing}>고객 링크 발행</button></form>
    <Result state={issued}/>
  </div>;
}
