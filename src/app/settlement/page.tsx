import Link from 'next/link';
import { getSettlementBalance } from '../../domain/settlement/settlement';
import { adminOperations } from '../../server/admin-operations';
import {
  collectAction,
  confirmSales,
  confirmSupplierAction,
  createBillingAction,
  disputeSales,
  finalizeAction,
  payoutAction,
  reconfirmSales,
  resolveIssue,
  saveAmounts,
  supplierIssueAction,
  syncDeliveredPerformances,
} from './actions';

import { requireAdminPageActor } from '../../server/auth/page-guard';
import { LogoutButton } from '../_auth/LogoutButton';
export const dynamic='force-dynamic';

const first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]??'':v??'';
const won=(v:number|null|undefined)=>typeof v==='number'?v.toLocaleString('ko-KR')+'원':'미확인';

const statusLabel:Record<string,string>={
  AWAITING_AMOUNTS:'금액 입력 대기',
  AWAITING_SALESPERSON_CONFIRMATION:'영업채널 확인 대기',
  AWAITING_SUPPLIER_REVIEW:'공급사 확인 대기',
  AWAITING_SALESPERSON_RECONFIRMATION:'영업채널 재확인',
  SUPPLIER_ISSUE:'이슈 해결 대기',
  READY_TO_FINALIZE:'정산확정 가능',
  FINALIZED:'정산확정',
};

export default async function SettlementPage({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>
}){
  await requireAdminPageActor();
  const q=await searchParams;
  const selectedId=first(q.id);
  const error=first(q.error);
  const synced=first(q.synced);
  const created=first(q.created);

  let operations;
  try{operations=adminOperations();}
  catch(err){
    return <main className="admin-shell"><header className="topbar"><div><strong>freepasserp.com</strong><span>admin</span></div></header><section className="panel"><h1>정산</h1><p>{(err as Error).message}</p></section></main>;
  }

  const performances=await operations.listPerformances();
  const selected=performances.find((x)=>x.id===selectedId)??performances[0]??null;
  const settlement=selected?await operations.findSettlementByPerformanceId(selected.id):null;
  const billing=settlement?await operations.getBillingBySettlementId(settlement.id):null;
  const ledger=settlement?await operations.listLedger(settlement.id):[];
  const balance=settlement?getSettlementBalance(settlement,billing??undefined,ledger):null;

  return <main className="admin-shell">
    <header className="topbar">
      <div><strong>freepasserp.com</strong><span>admin · operations ledger</span></div>
      <nav><Link href="/products">상품</Link><Link href="/intake">접수</Link><Link href="/settlement">정산</Link></nav>
      <div className="admin-user"><LogoutButton/></div>
    </header>

    <section className="workspace">
      <section className="panel product-panel">
        <div className="panel-head"><div><p className="eyebrow">PERFORMANCE</p><h1>실적 목록</h1></div><span className="count">{performances.length}건</span></div>
        <form action={syncDeliveredPerformances}><button className="new-app" type="submit">인도완료 접수 동기화</button></form>
        {synced&&<p>인도완료 접수를 실적 원장과 대조했습니다.</p>}
        {created==='1'&&<p>인도완료에서 실적 1건을 생성했습니다.</p>}
        {created==='replay'&&<p>이미 존재하는 실적을 다시 열었습니다.</p>}
        {error&&<p>{error}</p>}

        <div className="application-list">
          {performances.map((p)=><Link key={p.id} href={'/settlement?id='+encodeURIComponent(p.id)} className="application-card">
            <div className="app-top"><div><b>{p.snapshot.applicantName}</b><span>{p.snapshot.applicationNumber}</span></div><strong>{p.snapshot.vehicle.modelId}</strong></div>
            <p>{statusLabel[p.status]??p.status} · {p.snapshot.supplierId} · {p.snapshot.salesChannelId}</p>
          </Link>)}
          {performances.length===0&&<p>실적이 없습니다. 접수에서 인도완료 처리 후 자동 생성되거나 위 동기화 버튼으로 기존 인도완료 건을 가져옵니다.</p>}
        </div>
      </section>

      <section className="panel detail-panel">
        <div className="panel-head"><div><p className="eyebrow">PERFORMANCE DETAIL</p><h1>실적 상세</h1></div></div>
        {selected?<>
          <div className="vehicle-title"><div><h2>{selected.snapshot.applicantName}</h2><p>{selected.snapshot.applicationNumber} · {selected.snapshot.vehicle.modelId}</p></div><span className="status-dot">{statusLabel[selected.status]??selected.status}</span></div>
          <dl className="summary-grid">
            <div><dt>공급사 받을 돈</dt><dd>{won(selected.amounts.supplierReceivable)}</dd></div>
            <div><dt>영업채널 줄 돈</dt><dd>{won(selected.amounts.channelPayable)}</dd></div>
            <div><dt>VAT</dt><dd>{selected.amounts.vatMode}</dd></div>
            <div><dt>인도일</dt><dd>{selected.snapshot.deliveredAt}</dd></div>
            <div><dt>영업채널 확인</dt><dd>{selected.salespersonReview.status}</dd></div>
            <div><dt>공급사 확인</dt><dd>{selected.supplierReview.status}</dd></div>
          </dl>

          {settlement&&balance?<>
            <h3>확정 정산</h3>
            <dl className="summary-grid">
              <div><dt>받을 돈</dt><dd>{won(balance.confirmedReceivable)}</dd></div>
              <div><dt>청구</dt><dd>{won(balance.billed)}</dd></div>
              <div><dt>수금</dt><dd>{won(balance.collected)}</dd></div>
              <div><dt>미수</dt><dd>{won(balance.collectionOutstanding)}</dd></div>
              <div><dt>줄 돈</dt><dd>{won(balance.payable)}</dd></div>
              <div><dt>지급</dt><dd>{won(balance.paid)}</dd></div>
              <div><dt>미지급</dt><dd>{won(balance.payoutOutstanding)}</dd></div>
              <div><dt>마진</dt><dd>{won(balance.margin)}</dd></div>
            </dl>
          </>:null}
        </>:<p>왼쪽에서 실적을 선택하세요.</p>}
      </section>

      <section className="panel work-panel">
        <div className="panel-head"><div><p className="eyebrow">ACTION</p><h1>다음 업무</h1></div></div>
        {selected?<>
          {selected.status==='AWAITING_AMOUNTS'&&<form action={saveAmounts} className="form-stack">
            <input type="hidden" name="id" value={selected.id}/>
            <label>공급사 받을 금액<input name="supplierReceivable" required inputMode="numeric"/></label>
            <label>영업채널 지급 금액<input name="channelPayable" required inputMode="numeric"/></label>
            <label>VAT<select name="vatMode" defaultValue="EXCLUDED"><option value="EXCLUDED">VAT 별도</option><option value="INCLUDED">VAT 포함</option></select></label>
            <button className="primary" type="submit">금액 저장</button>
          </form>}

          {selected.status==='AWAITING_SALESPERSON_CONFIRMATION'&&<>
            <form action={confirmSales} className="form-stack">
              <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="partyId" value={selected.snapshot.salesChannelId}/>
              <button className="primary" type="submit">영업채널 확인 완료</button>
            </form>
            <form action={disputeSales} className="form-stack">
              <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="partyId" value={selected.snapshot.salesChannelId}/>
              <label>이견 사유<input name="reason" required/></label>
              <button className="danger-link" type="submit">영업채널 이견 기록</button>
            </form>
          </>}

          {selected.status==='AWAITING_SUPPLIER_REVIEW'&&<>
            <form action={confirmSupplierAction} className="form-stack">
              <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="partyId" value={selected.snapshot.supplierId}/>
              <button className="primary" type="submit">공급사 확인 완료</button>
            </form>
            <form action={supplierIssueAction} className="form-stack">
              <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="partyId" value={selected.snapshot.supplierId}/>
              <input type="hidden" name="vatMode" value={selected.amounts.vatMode}/>
              <label>공급사 제시 받을 금액<input name="supplierReceivable" required defaultValue={selected.amounts.supplierReceivable??''}/></label>
              <label>공급사 제시 지급 금액<input name="channelPayable" required defaultValue={selected.amounts.channelPayable??''}/></label>
              <label>이슈 사유<input name="reason" required/></label>
              <button className="danger-link" type="submit">공급사 이슈 기록</button>
            </form>
          </>}

          {selected.status==='AWAITING_SALESPERSON_RECONFIRMATION'&&<form action={reconfirmSales} className="form-stack">
            <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="partyId" value={selected.snapshot.salesChannelId}/>
            <p>공급사 변경 금액 때문에 영업채널 재확인이 필요합니다.</p>
            <button className="primary" type="submit">변경금액 재확인 완료</button>
          </form>}

          {selected.status==='SUPPLIER_ISSUE'&&<form action={resolveIssue} className="form-stack">
            <input type="hidden" name="id" value={selected.id}/>
            <label>해결 근거<input name="reason" required placeholder="양측 증빙 대조 결과"/></label>
            <button className="primary" type="submit">이슈 해결 기록</button>
          </form>}

          {selected.status==='READY_TO_FINALIZE'&&<form action={finalizeAction}>
            <input type="hidden" name="id" value={selected.id}/>
            <button className="primary" type="submit">정산 확정</button>
          </form>}

          {selected.status==='FINALIZED'&&settlement?<>
            {!billing?<form action={createBillingAction}>
              <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="settlementId" value={settlement.id}/>
              <button className="primary" type="submit">청구 생성</button>
            </form>:<p>청구 생성됨 · {won(billing.amount)}</p>}

            {billing&&balance&&balance.collectionOutstanding>0&&<form action={collectAction} className="form-stack">
              <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="settlementId" value={settlement.id}/>
              <label>수금액<input name="amount" required inputMode="numeric"/></label>
              <label>메모<input name="note"/></label>
              <button className="primary" type="submit">수금 기록</button>
            </form>}

            {billing&&balance&&balance.payoutOutstanding>0&&<form action={payoutAction} className="form-stack">
              <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="settlementId" value={settlement.id}/>
              <label>지급액<input name="amount" required inputMode="numeric"/></label>
              <label>메모<input name="note"/></label>
              <button className="primary" type="submit">영업채널 지급 기록</button>
              {balance.collectionOutstanding>0&&<small>현재 정책은 공급사 완납 전 지급을 차단합니다.</small>}
            </form>}

            <h3>원장</h3>
            {ledger.map((x)=><div key={x.id} className="work-hint"><b>{x.account} · {x.kind} · {won(x.amount)}</b><span>{x.occurredAt} · {x.actorId}{x.note?' · '+x.note:''}</span></div>)}
          </>:null}
        </>:<p>실적을 선택하세요.</p>}
      </section>
    </section>
  </main>;
}
