import Link from 'next/link';
import type { ApplicationStatus } from '../../domain/application/types';
import { applicationFacets, filterApplications } from '../../domain/application/search';
import { adminOperations } from '../../server/admin-operations';
import { adminRepositories } from '../../server/admin-runtime';
import { requireAdminPageActor } from '../../server/auth/page-guard';
import { LogoutButton } from '../_auth/LogoutButton';
import { cancelIntake, ensureIntakePerformance, setIntakeProgress } from './actions';

export const dynamic='force-dynamic';

const PAGE_SIZE=50;
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??'':value??'';
const positiveInt=(value:string,fallback=1)=>{const x=Number(value);return Number.isInteger(x)&&x>0?x:fallback;};
const won=(n:number|undefined)=>typeof n==='number'?n.toLocaleString('ko-KR')+'원':'미확인';

function statusLabel(status:string){
  if(status==='DELIVERED')return '인도완료';
  if(status==='CONTRACTED')return '계약완료';
  if(status==='CANCELLED')return '취소';
  return '접수완료';
}

function historyLabel(event:{type:string;key?:string;to?:boolean;reason?:string}){
  if(event.type==='APPLICATION_CREATED')return '접수 생성';
  if(event.type==='APPLICATION_CANCELLED')return '접수 취소 · '+String(event.reason??'');
  if(event.type==='APPLICATION_PROGRESS_CHANGED'){
    const labels:Record<string,string>={contractCompleted:'계약서',documentsCompleted:'필수서류',balanceCompleted:'잔금',deliveryCompleted:'인도'};
    return (labels[String(event.key)]??String(event.key))+' '+(event.to?'완료':'해제');
  }
  return event.type;
}

export default async function IntakePage({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>
}){
  await requireAdminPageActor();
  const q=await searchParams;
  const selectedId=first(q.id);
  const saved=first(q.saved);
  const error=first(q.error);
  const text=first(q.q);
  const rawStatus=first(q.status);
  const status=(['RECEIVED','CONTRACTED','DELIVERED','CANCELLED','ACTIVE'].includes(rawStatus)
    ?rawStatus
    :undefined) as ApplicationStatus|'ACTIVE'|undefined;
  const salesChannelId=first(q.channel)||undefined;
  const assigneeId=first(q.assignee)||undefined;
  const requestedPage=positiveInt(first(q.page));

  let applications;
  try{
    applications=await adminRepositories().applications.list();
  }catch(err){
    return <main className="admin-shell"><header className="topbar"><div><strong>freepasserp.com</strong><span>admin</span></div></header><section className="panel"><h1>접수</h1><p>{(err as Error).message}</p></section></main>;
  }

  const facets=applicationFacets(applications);
  const filtered=filterApplications(applications,{text,status,salesChannelId,assigneeId});
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const page=Math.min(requestedPage,totalPages);
  const visible=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const selected=applications.find((x)=>x.id===selectedId)??visible[0]??null;
  const performance=selected?.status==='DELIVERED'
    ?await adminOperations().getPerformance('performance:'+selected.id)
    :null;

  const href=(extra:Record<string,string>)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries({
      q:text,
      status:rawStatus,
      channel:salesChannelId??'',
      assignee:assigneeId??'',
      page:String(page),
      ...extra,
    })){
      if(value)params.set(key,value);
    }
    return '/intake?'+params.toString();
  };

  const progressRows=selected?[
    ['contractCompleted','계약서',selected.progress.contractCompleted],
    ['documentsCompleted','필수서류',selected.progress.documentsCompleted],
    ['balanceCompleted','잔금',selected.progress.balanceCompleted],
    ['deliveryCompleted','인도',selected.progress.deliveryCompleted],
  ] as const:[];

  const tabs=[
    ['','전체',facets.statusCounts.ALL],
    ['ACTIVE','진행중',facets.statusCounts.ACTIVE],
    ['RECEIVED','접수',facets.statusCounts.RECEIVED],
    ['CONTRACTED','계약완료',facets.statusCounts.CONTRACTED],
    ['DELIVERED','인도완료',facets.statusCounts.DELIVERED],
    ['CANCELLED','취소',facets.statusCounts.CANCELLED],
  ] as const;

  return <main className="admin-shell">
    <header className="topbar">
      <div><strong>freepasserp.com</strong><span>admin · 실제 Repository</span></div>
      <nav><Link href="/products">상품</Link><Link href="/intake">접수</Link><Link href="/settlement">정산</Link></nav>
      <div className="admin-user"><LogoutButton/></div>
    </header>

    <section className="workspace">
      <section className="panel product-panel">
        <div className="panel-head">
          <div><p className="eyebrow">APPLICATION</p><h1>접수 목록</h1></div>
          <span className="count">{filtered.length}/{applications.length}건 · {page}/{totalPages}</span>
        </div>

        {saved==='1'&&<p>새 접수가 저장되었습니다.</p>}
        {saved==='replay'&&<p>같은 submissionId 요청이라 기존 접수를 다시 열었습니다.</p>}
        {error&&<p>{error}</p>}

        <div className="work-tabs">
          {tabs.map(([value,label,count])=><Link
            key={label}
            href={href({status:value,page:'1',id:''})}
            className={(rawStatus||'')===value?'active':''}
          >{label} {count}</Link>)}
        </div>

        <form className="intake-filter-grid">
          <input name="q" defaultValue={text} placeholder="고객·접수번호·전화·차량 검색"/>
          <select name="status" defaultValue={rawStatus}>
            <option value="">전체 상태</option>
            <option value="ACTIVE">진행중</option>
            <option value="RECEIVED">접수완료</option>
            <option value="CONTRACTED">계약완료</option>
            <option value="DELIVERED">인도완료</option>
            <option value="CANCELLED">취소</option>
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
          <Link href="/intake">초기화</Link>
        </form>

        <div className="application-list">
          {visible.map((app)=><Link
            key={app.id}
            href={href({id:app.id})}
            className={'application-card '+(app.id===selected?.id?'selected':'')}
          >
            <div className="app-top">
              <div><b>{app.applicantName}</b><span>{app.applicationNumber}</span></div>
              <strong>{app.snapshot.vehicle.modelId}</strong>
            </div>
            <div className="checks">
              <span className={app.progress.contractCompleted?'done':''}>계약서</span>
              <span className={app.progress.documentsCompleted?'done':''}>서류</span>
              <span className={app.progress.balanceCompleted?'done':''}>잔금</span>
              <span className={app.progress.deliveryCompleted?'done':''}>인도</span>
            </div>
            <p>{statusLabel(app.status)} · {app.salesChannelId} · {app.assigneeId}</p>
            <p>{app.snapshot.registration?.vehicleNumber||'차량번호 미입력'} · {app.snapshot.offer.termMonths}개월 · 월 {won(app.snapshot.offer.monthlyRent)}</p>
          </Link>)}
          {filtered.length===0&&<p>조건에 맞는 접수가 없습니다.</p>}
        </div>

        {totalPages>1&&<div className="quick-filters">
          {page>1&&<Link href={href({page:String(page-1),id:''})}>이전</Link>}
          <span>{page} / {totalPages}</span>
          {page<totalPages&&<Link href={href({page:String(page+1),id:''})}>다음</Link>}
        </div>}
      </section>

      <section className="panel detail-panel">
        <div className="panel-head"><div><p className="eyebrow">SNAPSHOT</p><h1>접수 당시 조건</h1></div></div>
        {selected?<>
          <div className="vehicle-title">
            <div><h2>{selected.snapshot.vehicle.modelId}</h2><p>{selected.snapshot.supplierId} · product v{selected.snapshot.productVersion}</p></div>
            <span className="status-dot">{selected.snapshot.vehicle.matchLevel}</span>
          </div>
          <dl className="summary-grid">
            <div><dt>접수번호</dt><dd>{selected.applicationNumber}</dd></div>
            <div><dt>고객</dt><dd>{selected.applicantName}</dd></div>
            <div><dt>연락처</dt><dd>{selected.applicantPhone||'미입력'}</dd></div>
            <div><dt>차량번호</dt><dd>{selected.snapshot.registration?.vehicleNumber||'미입력'}</dd></div>
            <div><dt>기간</dt><dd>{selected.snapshot.offer.termMonths}개월</dd></div>
            <div><dt>월 대여료</dt><dd>{won(selected.snapshot.offer.monthlyRent)}</dd></div>
            <div><dt>보증금</dt><dd>{won(selected.snapshot.offer.deposit)}</dd></div>
            <div><dt>영업채널</dt><dd>{selected.salesChannelId}</dd></div>
            <div><dt>담당자</dt><dd>{selected.assigneeId}</dd></div>
          </dl>
          <div className="chips">{selected.snapshot.productPolicies.map((p)=><span key={p.policyId}>{p.policyId}: {Array.isArray(p.value)?p.value.join(', '):String(p.value)}</span>)}</div>

          <h3>변경 이력</h3>
          {[...selected.history].reverse().slice(0,8).map((event,index)=><div className="work-hint" key={event.occurredAt+'-'+index}>
            <b>{historyLabel(event)}</b>
            <span>{event.occurredAt} · {event.actor.id}</span>
          </div>)}
        </>:<p>접수를 선택하세요.</p>}
      </section>

      <section className="panel work-panel">
        <div className="panel-head"><div><p className="eyebrow">WORK</p><h1>접수 상세</h1></div><Link className="new-app" href="/products">+ 신규접수</Link></div>
        {selected?<>
          <div className={'application-status '+(selected.status==='CANCELLED'?'cancelled':'')}>{statusLabel(selected.status)}</div>
          <div className="progress-actions">
            {progressRows.map(([key,label,done])=><form key={key} action={setIntakeProgress}>
              <input type="hidden" name="id" value={selected.id}/>
              <input type="hidden" name="key" value={key}/>
              <input type="hidden" name="completed" value={done?'false':'true'}/>
              <button type="submit" className={done?'done':''} disabled={selected.status==='CANCELLED'}>{label} {done?'✓':'-'}</button>
            </form>)}
          </div>

          {selected.status==='DELIVERED'&&(
            performance
              ?<Link className="primary" href={'/settlement?id='+encodeURIComponent(performance.id)}>실적·정산 열기</Link>
              :<form action={ensureIntakePerformance}>
                <input type="hidden" name="id" value={selected.id}/>
                <button className="primary" type="submit">실적 생성 후 정산 열기</button>
              </form>
          )}

          {selected.status!=='CANCELLED'&&<form action={cancelIntake} className="form-stack">
            <input type="hidden" name="id" value={selected.id}/>
            <label>취소 사유<input name="reason" required placeholder="삭제하지 않고 사유를 남깁니다."/></label>
            <button className="danger-link" type="submit">접수 취소</button>
          </form>}
        </>:<p>왼쪽에서 접수를 선택하세요.</p>}
      </section>
    </section>
  </main>;
}
