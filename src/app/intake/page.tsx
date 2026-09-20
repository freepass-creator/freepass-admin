import Link from 'next/link';
import { adminRepositories } from '../../server/admin-runtime';
import { cancelIntake, setIntakeProgress } from './actions';

export const dynamic='force-dynamic';

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??'':value??'';
const won=(n:number|undefined)=>typeof n==='number'?n.toLocaleString('ko-KR')+'원':'미확인';

function statusLabel(status:string){
  if(status==='DELIVERED')return '인도완료';
  if(status==='CONTRACTED')return '계약완료';
  if(status==='CANCELLED')return '취소';
  return '접수완료';
}

export default async function IntakePage({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>
}){
  const q=await searchParams;
  const selectedId=first(q.id);
  const saved=first(q.saved);
  const error=first(q.error);

  let applications;
  try{
    applications=await adminRepositories().applications.list();
  }catch(err){
    return <main className="admin-shell"><header className="topbar"><div><strong>freepasserp.com</strong><span>admin</span></div></header><section className="panel"><h1>접수</h1><p>{(err as Error).message}</p></section></main>;
  }
  const selected=applications.find((x)=>x.id===selectedId)??applications[0]??null;

  const progressRows = selected ? [
    ['contractCompleted','계약서',selected.progress.contractCompleted],
    ['documentsCompleted','필수서류',selected.progress.documentsCompleted],
    ['balanceCompleted','잔금',selected.progress.balanceCompleted],
    ['deliveryCompleted','인도',selected.progress.deliveryCompleted],
  ] as const : [];

  return <main className="admin-shell">
    <header className="topbar">
      <div><strong>freepasserp.com</strong><span>admin · 실제 Repository</span></div>
      <nav><Link href="/products">상품</Link><Link href="/intake">접수</Link><Link href="/settlement">정산</Link></nav>
      <div className="admin-user">P1</div>
    </header>
    <section className="workspace">
      <section className="panel product-panel">
        <div className="panel-head"><div><p className="eyebrow">APPLICATION</p><h1>접수 목록</h1></div><span className="count">{applications.length}건</span></div>
        {saved==='1'&&<p>새 접수가 저장되었습니다.</p>}
        {saved==='replay'&&<p>같은 submissionId 요청이라 기존 접수를 다시 열었습니다.</p>}
        {error&&<p>{error}</p>}
        <div className="application-list">
          {applications.map((app)=><Link key={app.id} href={'/intake?id='+encodeURIComponent(app.id)} className="application-card">
            <div className="app-top"><div><b>{app.applicantName}</b><span>{app.applicationNumber}</span></div><strong>{app.snapshot.vehicle.modelId}</strong></div>
            <div className="checks">
              <span className={app.progress.contractCompleted?'done':''}>계약서</span>
              <span className={app.progress.documentsCompleted?'done':''}>서류</span>
              <span className={app.progress.deliveryCompleted?'done':''}>인도</span>
            </div>
            <p>{statusLabel(app.status)} · {app.snapshot.offer.termMonths}개월 · 월 {won(app.snapshot.offer.monthlyRent)}</p>
          </Link>)}
          {applications.length===0&&<p>저장된 접수가 없습니다. <Link href="/products">상품찾기</Link>에서 첫 접수를 만드세요.</p>}
        </div>
      </section>

      <section className="panel detail-panel">
        <div className="panel-head"><div><p className="eyebrow">SNAPSHOT</p><h1>접수 당시 조건</h1></div></div>
        {selected?<>

          <div className="vehicle-title"><div><h2>{selected.snapshot.vehicle.modelId}</h2><p>{selected.snapshot.supplierId} · product v{selected.snapshot.productVersion}</p></div><span className="status-dot">{selected.snapshot.vehicle.matchLevel}</span></div>
          <dl className="summary-grid">
            <div><dt>접수번호</dt><dd>{selected.applicationNumber}</dd></div>
            <div><dt>고객</dt><dd>{selected.applicantName}</dd></div>
            <div><dt>기간</dt><dd>{selected.snapshot.offer.termMonths}개월</dd></div>
            <div><dt>월 대여료</dt><dd>{won(selected.snapshot.offer.monthlyRent)}</dd></div>
            <div><dt>보증금</dt><dd>{won(selected.snapshot.offer.deposit)}</dd></div>
            <div><dt>영업채널</dt><dd>{selected.salesChannelId}</dd></div>
          </dl>
          <div className="chips">{selected.snapshot.productPolicies.map((p)=><span key={p.policyId}>{p.policyId}: {Array.isArray(p.value)?p.value.join(', '):String(p.value)}</span>)}</div>
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

          {selected.status==='DELIVERED'&&<p>인도 완료 감사이력이 있으므로 실적 생성 대상입니다. 다음 P2에서 Performance/정산 저장소에 연결합니다.</p>}

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
