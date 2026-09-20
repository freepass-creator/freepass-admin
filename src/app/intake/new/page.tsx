import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { adminRepositories } from '../../../server/admin-runtime';
import { submitIntake } from '../actions';

import { requireAdminPageActor } from '../../../server/auth/page-guard';
import { LogoutButton } from '../../_auth/LogoutButton';
export const dynamic='force-dynamic';
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??'':value??'';

export default async function NewIntakePage({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>
}){
  await requireAdminPageActor();
  const q=await searchParams;
  const productId=first(q.productId);
  const offerId=first(q.offerId);
  const expected=Number(first(q.version));
  const error=first(q.error);

  let product=null;
  try{product=productId?await adminRepositories().products.get(productId):null;}catch{}
  const offer=product?.offers.find((x)=>x.id===offerId)??null;
  const version=product?.version??(Number.isFinite(expected)?expected:0);

  return <main className="admin-shell">
    <header className="topbar"><div><strong>freepasserp.com</strong><span>admin · 신규접수</span></div><nav><Link href="/products">상품</Link><Link href="/intake">접수</Link></nav><div className="admin-user"><LogoutButton/></div></header>
    <section className="workspace">
      <section className="panel product-panel"><h1>접수 상품</h1>{product&&offer?<div className="selected-offer-card"><span>Snapshot 대상</span><h2>{product.vehicle.modelId}</h2><p>{product.supplierId} · v{product.version}</p><b>{offer.termMonths}개월 · 월 {offer.monthlyRent.toLocaleString('ko-KR')}원</b></div>:<p>상품/Offer를 찾을 수 없습니다. <Link href="/products">상품찾기</Link>에서 다시 선택하세요.</p>}</section>
      <section className="panel detail-panel"><h1>계약조건</h1>{offer?<dl className="summary-grid"><div><dt>보증금</dt><dd>{offer.deposit?.toLocaleString('ko-KR')??'미확인'}원</dd></div><div><dt>주행거리</dt><dd>{offer.annualMileageKm?.toLocaleString('ko-KR')??'미확인'}</dd></div></dl>:null}</section>
      <section className="panel work-panel">
        <div className="panel-head"><div><p className="eyebrow">NEW APPLICATION</p><h1>신규 접수</h1></div></div>
        {error&&<p>{error}</p>}
        {product&&offer?<form action={submitIntake} className="form-stack">
          <input type="hidden" name="productId" value={product.id}/>
          <input type="hidden" name="offerId" value={offer.id}/>
          <input type="hidden" name="expectedProductVersion" value={version}/>
          <input type="hidden" name="submissionId" value={randomUUID()}/>
          <label>영업채널<input name="salesChannelId" required placeholder="channel-id"/></label>
          <label>담당자<input name="assigneeId" required placeholder="assignee-id"/></label>
          <label>고객명<input name="applicantName" required/></label>
          <label>연락처 (선택)<input name="applicantPhone"/></label>
          <button className="primary" type="submit">접수 저장</button>
        </form>:null}
      </section>
    </section>
  </main>;
}
