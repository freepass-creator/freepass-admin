import Link from 'next/link';
import type { PerformanceStatus } from '../../domain/performance/types';
import { filterPerformances, performanceFacets } from '../../domain/performance/search';
import {
  getClawbackCashBalance,
  getClawbackSummary,
  getSettlementBalance,
  getSettlementNetBalance,
} from '../../domain/settlement/settlement';
import { adminOperations } from '../../server/admin-operations';
import { requireAdminPageActor } from '../../server/auth/page-guard';
import { LogoutButton } from '../_auth/LogoutButton';
import {
  collectAction,
  confirmSales,
  confirmSupplierAction,
  createBillingAction,
  createClawbackAction,
  createClawbackBillingAction,
  disputeSales,
  finalizeAction,
  payoutAction,
  channelRecoveryAction,
  reconfirmSales,
  recordBillingEvidenceAction,
  recordClawbackBillingEvidenceAction,
  resolveIssue,
  reverseLedgerAction,
  saveAmounts,
  supplierIssueAction,
  supplierRefundAction,
  suggestAmounts,
  syncDeliveredPerformances,
} from './actions';

export const dynamic='force-dynamic';

const PAGE_SIZE=50;
const first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]??'':v??'';
const positiveInt=(value:string,fallback=1)=>{const x=Number(value);return Number.isInteger(x)&&x>0?x:fallback;};
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
  const text=first(q.q);
  const rawStatus=first(q.status);
  const allowedStatuses=[
    'AWAITING_AMOUNTS',
    'AWAITING_SALESPERSON_CONFIRMATION',
    'AWAITING_SUPPLIER_REVIEW',
    'AWAITING_SALESPERSON_RECONFIRMATION',
    'SUPPLIER_ISSUE',
    'READY_TO_FINALIZE',
    'FINALIZED',
    'OPEN',
  ];
  const status=(allowedStatuses.includes(rawStatus)?rawStatus:undefined) as PerformanceStatus|'OPEN'|undefined;
  const supplierId=first(q.supplier)||undefined;
  const salesChannelId=first(q.channel)||undefined;
  const assigneeId=first(q.assignee)||undefined;
  const requestedPage=positiveInt(first(q.page));

  let operations;
  try{operations=adminOperations();}
  catch(err){
    return <main className="admin-shell"><header className="topbar"><div><strong>freepasserp.com</strong><span>admin</span></div></header><section className="panel"><h1>정산</h1><p>{(err as Error).message}</p></section></main>;
  }

  const performances=await operations.listPerformances();
  const facets=performanceFacets(performances);
  const filtered=filterPerformances(performances,{text,status,supplierId,salesChannelId,assigneeId});
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const page=Math.min(requestedPage,totalPages);
  const visible=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const selected=performances.find((x)=>x.id===selectedId)??visible[0]??null;

  const settlement=selected?await operations.findSettlementByPerformanceId(selected.id):null;
  const billing=settlement?await operations.getBillingBySettlementId(settlement.id):null;
  const ledger=settlement?await operations.listLedger(settlement.id):[];
  const clawbacks=settlement?await operations.listClawbacks(settlement.id):[];
  const clawbackBillingRows=await Promise.all(
    clawbacks.map(async(item)=>[
      item.id,
      await operations.getClawbackBillingByClawbackId(item.id),
    ] as const),
  );
  const clawbackBillingById=new Map(clawbackBillingRows);
  const balance=settlement?getSettlementBalance(settlement,billing??undefined,ledger):null;
  const clawbackSummary=settlement?getClawbackSummary(settlement,clawbacks):null;
  const netBalance=settlement
    ?getSettlementNetBalance(settlement,billing??undefined,ledger,clawbacks)
    :null;
  const clawbackCashById=new Map(
    clawbacks.map((item)=>[item.id,getClawbackCashBalance(item,ledger)]),
  );
  const reversedIds=new Set(
    ledger
      .filter((entry)=>entry.kind==='REVERSAL'&&entry.reversalOfEntryId)
      .map((entry)=>entry.reversalOfEntryId as string),
  );

  const href=(extra:Record<string,string>)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries({
      q:text,
      status:rawStatus,
      supplier:supplierId??'',
      channel:salesChannelId??'',
      assignee:assigneeId??'',
      page:String(page),
      ...extra,
    })){
      if(value)params.set(key,value);
    }
    return '/settlement?'+params.toString();
  };

  const tabs=[
    ['','전체',facets.statusCounts.ALL],
    ['OPEN','진행중',facets.statusCounts.OPEN],
    ['READY_TO_FINALIZE','확정대기',facets.statusCounts.READY_TO_FINALIZE],
    ['SUPPLIER_ISSUE','이슈',facets.statusCounts.SUPPLIER_ISSUE],
    ['FINALIZED','정산확정',facets.statusCounts.FINALIZED],
  ] as const;

  return <main className="admin-shell">
    <header className="topbar">
      <div><strong>freepasserp.com</strong><span>admin · operations ledger</span></div>
      <nav><Link href="/products">상품</Link><Link href="/intake">접수</Link><Link href="/settlement">정산</Link></nav>
      <div className="admin-user"><LogoutButton/></div>
    </header>

    <section className="workspace">
      <section className="panel product-panel">
        <div className="panel-head">
          <div><p className="eyebrow">PERFORMANCE</p><h1>실적 목록</h1></div>
          <span className="count">{filtered.length}/{performances.length}건 · {page}/{totalPages}</span>
        </div>

        <form action={syncDeliveredPerformances}><button className="new-app" type="submit">인도완료 접수 동기화</button></form>
        {synced&&<p>인도완료 접수를 실적 원장과 대조했습니다.</p>}
        {created==='1'&&<p>인도완료에서 실적 1건을 생성했습니다.</p>}
        {created==='replay'&&<p>이미 존재하는 실적을 다시 열었습니다.</p>}
        {error&&<p>{error}</p>}

        <div className="work-tabs">
          {tabs.map(([value,label,count])=><Link
            key={label}
            href={href({status:value,page:'1',id:''})}
            className={(rawStatus||'')===value?'active':''}
          >{label} {count}</Link>)}
        </div>

        <form className="settlement-filter-grid">
          <input name="q" defaultValue={text} placeholder="고객·접수번호·차량번호 검색"/>
          <select name="status" defaultValue={rawStatus}>
            <option value="">전체 상태</option>
            <option value="OPEN">진행중 전체</option>
            <option value="AWAITING_AMOUNTS">금액 입력 대기</option>
            <option value="AWAITING_SALESPERSON_CONFIRMATION">영업채널 확인</option>
            <option value="AWAITING_SUPPLIER_REVIEW">공급사 확인</option>
            <option value="AWAITING_SALESPERSON_RECONFIRMATION">영업채널 재확인</option>
            <option value="SUPPLIER_ISSUE">이슈 해결</option>
            <option value="READY_TO_FINALIZE">정산확정 가능</option>
            <option value="FINALIZED">정산확정</option>
          </select>
          <select name="supplier" defaultValue={supplierId??''}>
            <option value="">전체 공급사</option>
            {facets.suppliers.map((value)=><option key={value} value={value}>{value}</option>)}
          </select>
          <select name="channel" defaultValue={salesChannelId??''}>
            <option value="">전체 영업채널</option>
            {facets.salesChannels.map((value)=><option key={value} value={value}>{value}</option>)}
          </select>
          <select name="assignee" defaultValue={assigneeId??''}>
            <option value="">전체 담당자</option>
            {facets.assignees.map((value)=><option key={value} value={value}>{value}</option>)}
          </select>
          <button type="submit">적용</button>
          <Link href="/settlement">초기화</Link>
        </form>

        <div className="application-list">
          {visible.map((p)=><Link
            key={p.id}
            href={href({id:p.id})}
            className={'application-card '+(p.id===selected?.id?'selected':'')}
          >
            <div className="app-top">
              <div><b>{p.snapshot.applicantName}</b><span>{p.snapshot.applicationNumber}</span></div>
              <strong>{p.snapshot.vehicle.modelId}</strong>
            </div>
            <p>{statusLabel[p.status]??p.status}</p>
            <p>{p.snapshot.registration?.vehicleNumber||'차량번호 미입력'} · {p.snapshot.supplierId} · {p.snapshot.salesChannelId}</p>
          </Link>)}
          {filtered.length===0&&<p>조건에 맞는 실적이 없습니다.</p>}
        </div>

        {totalPages>1&&<div className="quick-filters">
          {page>1&&<Link href={href({page:String(page-1),id:''})}>이전</Link>}
          <span>{page} / {totalPages}</span>
          {page<totalPages&&<Link href={href({page:String(page+1),id:''})}>다음</Link>}
        </div>}
      </section>

      <section className="panel detail-panel">
        <div className="panel-head"><div><p className="eyebrow">PERFORMANCE DETAIL</p><h1>실적 상세</h1></div></div>
        {selected?<>
          <div className="vehicle-title">
            <div><h2>{selected.snapshot.applicantName}</h2><p>{selected.snapshot.applicationNumber} · {selected.snapshot.vehicle.modelId}</p></div>
            <span className="status-dot">{statusLabel[selected.status]??selected.status}</span>
          </div>

          <dl className="summary-grid">
            <div><dt>차량번호</dt><dd>{selected.snapshot.registration?.vehicleNumber||'미입력'}</dd></div>
            <div><dt>담당자</dt><dd>{selected.snapshot.assigneeId}</dd></div>
            <div><dt>공급사 받을 돈</dt><dd>{won(selected.amounts.supplierReceivable)}</dd></div>
            <div><dt>영업채널 줄 돈</dt><dd>{won(selected.amounts.channelPayable)}</dd></div>
            <div><dt>VAT</dt><dd>{selected.amounts.vatMode}</dd></div>
            <div><dt>인도일</dt><dd>{selected.snapshot.deliveredAt}</dd></div>
            <div><dt>영업채널 확인</dt><dd>{selected.salespersonReview.status}</dd></div>
            <div><dt>공급사 확인</dt><dd>{selected.supplierReview.status}</dd></div>
          </dl>
          {selected.pricingEvidence&&<div className="work-hint">
            <b>자동 산출 근거 · {selected.pricingEvidence.ruleId||selected.pricingEvidence.engineId}</b>
            <span>{selected.pricingEvidence.explanation} · engine {selected.pricingEvidence.engineRevision}</span>
          </div>}

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
            {netBalance&&clawbacks.length>0&&<>
              <h3>환수 반영 현재 포지션</h3>
              <dl className="summary-grid">
                <div><dt>순 받을 돈</dt><dd>{won(netBalance.netReceivable)}</dd></div>
                <div><dt>순 수금</dt><dd>{won(netBalance.netCollected)}</dd></div>
                <div><dt>추가 수금 가능</dt><dd>{won(netBalance.collectionOutstanding)}</dd></div>
                <div><dt>공급사 환불 필요</dt><dd>{won(netBalance.supplierRefundOutstanding)}</dd></div>
                <div><dt>순 줄 돈</dt><dd>{won(netBalance.netPayable)}</dd></div>
                <div><dt>순 지급</dt><dd>{won(netBalance.netPaid)}</dd></div>
                <div><dt>추가 지급 가능</dt><dd>{won(netBalance.payoutOutstanding)}</dd></div>
                <div><dt>영업채널 회수 필요</dt><dd>{won(netBalance.channelRecoveryOutstanding)}</dd></div>
                <div><dt>환수 후 마진</dt><dd>{won(netBalance.netMargin)}</dd></div>
              </dl>
            </>}
            {clawbackSummary&&clawbacks.length>0&&<>
              <h3>환수</h3>
              <dl className="summary-grid">
                <div><dt>공급사 누적 환수</dt><dd>-{won(clawbackSummary.supplierClawback)}</dd></div>
                <div><dt>공급사 환수 후 순액</dt><dd>{won((settlement?.supplierReceivable??0)-clawbackSummary.supplierClawback)}</dd></div>
                <div><dt>영업채널 누적 환수</dt><dd>-{won(clawbackSummary.channelClawback)}</dd></div>
                <div><dt>영업채널 환수 후 순액</dt><dd>{won((settlement?.channelPayable??0)-clawbackSummary.channelClawback)}</dd></div>
              </dl>
              {clawbacks.map((item)=>{
                const adjustment=clawbackBillingById.get(item.id);
                return <div key={item.id} className="work-hint">
                  <b>{item.occurredAt} · 공급사 -{won(item.supplierAmount)} · 영업채널 -{won(item.channelAmount)}</b>
                  <span>{item.reason} · {item.createdBy}</span>
                  <span>
                    계산서 조정 {adjustment
                      ?adjustment.status==='EVIDENCE_COMPLETE'
                        ?'증빙완료 · '+(adjustment.invoiceEvidence?.reference??'')
                        :'생성됨 · 증빙대기'
                      :'미생성'}
                  </span>
                </div>;
              })}
            </>}
          </>:null}
        </>:<p>왼쪽에서 실적을 선택하세요.</p>}
      </section>

      <section className="panel work-panel">
        <div className="panel-head"><div><p className="eyebrow">ACTION</p><h1>다음 업무</h1></div></div>

        {selected?<>
          {selected.status==='AWAITING_AMOUNTS'&&<>
            <form action={suggestAmounts} className="form-stack">
              <input type="hidden" name="id" value={selected.id}/>
              <button className="primary" type="submit">기존 정산 규칙 자동추천</button>
              <small>확정 규칙만 자동으로 넣습니다. 공급사·상품형태·차량가액 등이 불명확하면 저장하지 않고 검토 사유를 표시합니다.</small>
            </form>
            <form action={saveAmounts} className="form-stack">
            <input type="hidden" name="id" value={selected.id}/>
            <label>공급사 받을 금액<input name="supplierReceivable" required inputMode="numeric"/></label>
            <label>영업채널 지급 금액<input name="channelPayable" required inputMode="numeric"/></label>
            <label>VAT<select name="vatMode" defaultValue="EXCLUDED"><option value="EXCLUDED">VAT 별도</option><option value="INCLUDED">VAT 포함</option></select></label>
            <button className="primary" type="submit">금액 직접 저장</button>
          </form>
          </>}

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
            </form>:<>
              <p>청구 생성됨 · {won(billing.amount)}</p>
              {billing.status==='CREATED'?<form action={recordBillingEvidenceAction} className="form-stack">
                <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="settlementId" value={settlement.id}/>
                <label>계산서 증빙번호<input name="reference" required placeholder="계산서/세금계산서 식별번호"/></label>
                <label>발행일<input name="issuedAt" required type="date"/></label>
                <label>메모<input name="note"/></label>
                <button className="primary" type="submit">계산서 처리 기록</button>
              </form>:<div className="work-hint">
                <b>계산서 처리 완료 · {billing.invoiceEvidence?.reference}</b>
                <span>{billing.invoiceEvidence?.issuedAt} · {billing.invoiceEvidence?.recordedBy}</span>
              </div>}
            </>}

            {billing&&billing.status!=='EVIDENCE_COMPLETE'&&<small>계산서 처리 증빙이 완료되어야 수금을 기록할 수 있습니다.</small>}

            {billing?.status==='EVIDENCE_COMPLETE'&&netBalance&&netBalance.collectionOutstanding>0&&<form action={collectAction} className="form-stack">
              <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="settlementId" value={settlement.id}/>
              <label>수금액<input name="amount" required inputMode="numeric"/></label>
              <label>메모<input name="note"/></label>
              <button className="primary" type="submit">수금 기록</button>
            </form>}

            {billing?.status==='EVIDENCE_COMPLETE'&&netBalance&&netBalance.payoutOutstanding>0
              &&netBalance.collectionOutstanding===0&&netBalance.supplierRefundOutstanding===0
              &&<form action={payoutAction} className="form-stack">
                <input type="hidden" name="id" value={selected.id}/><input type="hidden" name="settlementId" value={settlement.id}/>
                <label>지급액<input name="amount" required inputMode="numeric"/></label>
                <label>메모<input name="note"/></label>
                <button className="primary" type="submit">영업채널 지급 기록</button>
              </form>}
            {billing?.status==='EVIDENCE_COMPLETE'&&netBalance&&netBalance.payoutOutstanding>0
              &&(netBalance.collectionOutstanding>0||netBalance.supplierRefundOutstanding>0)
              &&<small>현재 정책은 공급사 순정산이 완료되어야 영업채널 지급을 기록할 수 있습니다.</small>}

            <h3>환수 등록</h3>
            <form action={createClawbackAction} className="form-stack">
              <input type="hidden" name="id" value={selected.id}/>
              <input type="hidden" name="settlementId" value={settlement.id}/>
              <label>공급사 환수액<input name="supplierAmount" required inputMode="numeric"/></label>
              <label>영업채널 환수액<input name="channelAmount" inputMode="numeric" placeholder="비우면 기존 지급/청구 비율로 계산"/></label>
              <label>환수 발생일<input name="occurredAt" type="date"/></label>
              <label>환수 사유<input name="reason" required placeholder="중도해지·유지조건 미충족 등"/></label>
              <button className="danger-link" type="submit">환수 사건 등록</button>
              <small>환수는 원 정산과 원장을 수정하지 않습니다. 잘못 입력한 수금/지급의 정정은 아래 원장 정정을 사용합니다.</small>
            </form>

            {netBalance&&clawbacks.map((item)=>{
              const cash=clawbackCashById.get(item.id);
              if(!cash)return null;
              const refundAllowed=Math.min(
                cash.supplierRefundRemaining,
                netBalance.supplierRefundOutstanding,
              );
              const recoveryAllowed=Math.min(
                cash.channelRecoveryRemaining,
                netBalance.channelRecoveryOutstanding,
              );
              const adjustment=clawbackBillingById.get(item.id);
              return <div key={'cash:'+item.id} className="work-hint">
                <b>환수 처리 · {item.reason}</b>
                <span>
                  조정 공급가 {won(item.supplierImpact.net)} · VAT {won(item.supplierImpact.vat)}
                  {' · '}조정 합계 {won(item.supplierImpact.total)}
                </span>
                {!adjustment?<form action={createClawbackBillingAction} className="form-stack">
                  <input type="hidden" name="id" value={selected.id}/>
                  <input type="hidden" name="settlementId" value={settlement.id}/>
                  <input type="hidden" name="clawbackId" value={item.id}/>
                  <button type="submit">환수 계산서 조정 생성</button>
                </form>:adjustment.status==='CREATED'?<form action={recordClawbackBillingEvidenceAction} className="form-stack">
                  <input type="hidden" name="id" value={selected.id}/>
                  <input type="hidden" name="settlementId" value={settlement.id}/>
                  <input type="hidden" name="clawbackId" value={item.id}/>
                  <label>조정 증빙번호<input name="reference" required/></label>
                  <label>발행일<input name="issuedAt" required type="date"/></label>
                  <label>메모<input name="note"/></label>
                  <button type="submit">환수 계산서 증빙 완료</button>
                </form>:<span>환수 계산서 증빙 완료 · {adjustment.invoiceEvidence?.reference}</span>}
                <span>
                  공급사 환불 {won(cash.supplierRefunded)}/{won(cash.supplierTarget)}
                  {' · '}
                  영업채널 회수 {won(cash.channelRecovered)}/{won(cash.channelTarget)}
                </span>
                {refundAllowed>0&&<form action={supplierRefundAction} className="form-stack">
                  <input type="hidden" name="id" value={selected.id}/>
                  <input type="hidden" name="settlementId" value={settlement.id}/>
                  <input type="hidden" name="clawbackId" value={item.id}/>
                  <label>공급사 환불액<input name="amount" required inputMode="numeric" max={refundAllowed}/></label>
                  <label>메모<input name="note"/></label>
                  <button type="submit">공급사 환불 기록</button>
                </form>}
                {recoveryAllowed>0&&<form action={channelRecoveryAction} className="form-stack">
                  <input type="hidden" name="id" value={selected.id}/>
                  <input type="hidden" name="settlementId" value={settlement.id}/>
                  <input type="hidden" name="clawbackId" value={item.id}/>
                  <label>영업채널 회수액<input name="amount" required inputMode="numeric" max={recoveryAllowed}/></label>
                  <label>메모<input name="note"/></label>
                  <button type="submit">영업채널 회수 기록</button>
                </form>}
              </div>;
            })}

            <h3>원장</h3>
            {ledger.map((entry)=>{
              const reversed=entry.kind==='CASH'&&reversedIds.has(entry.id);
              return <div key={entry.id} className="work-hint">
                <b>{entry.account} · {entry.kind} · {won(entry.amount)}{reversed?' · 정정됨':''}</b>
                <span>{entry.occurredAt} · {entry.actorId}{entry.clawbackId?' · 환수 '+entry.clawbackId:''}{entry.note?' · '+entry.note:''}{entry.reversalOfEntryId?' · 원본 '+entry.reversalOfEntryId:''}</span>
                {entry.kind==='CASH'&&!reversed&&<form action={reverseLedgerAction} className="ledger-reversal-form">
                  <input type="hidden" name="id" value={selected.id}/>
                  <input type="hidden" name="settlementId" value={settlement.id}/>
                  <input type="hidden" name="originalId" value={entry.id}/>
                  <input type="hidden" name="account" value={entry.account}/>
                  <input type="hidden" name="amount" value={entry.amount}/>
                  {entry.clawbackId&&<input type="hidden" name="clawbackId" value={entry.clawbackId}/>}
                  <input name="reason" required placeholder="정정 사유"/>
                  <button type="submit">원장 정정</button>
                </form>}
              </div>;
            })}
            {ledger.some((entry)=>entry.kind==='CASH'&&entry.account==='SUPPLIER_COLLECTION'&&!reversedIds.has(entry.id))
              &&ledger.some((entry)=>entry.kind==='CASH'&&entry.account==='CHANNEL_PAYOUT'&&!reversedIds.has(entry.id))
              &&<small>완납 후 지급정책에서는 수금을 정정하기 전에 지급 원장을 먼저 정정해야 합니다.</small>}
          </>:null}
        </>:<p>실적을 선택하세요.</p>}
      </section>
    </section>
  </main>;
}
