import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { applicationFacets } from '../../../domain/application/search';
import { adminRepositories } from '../../../server/admin-runtime';
import { requireAdminPageActor } from '../../../server/auth/page-guard';
import { LogoutButton } from '../../_auth/LogoutButton';
import { submitIntake } from '../actions';

export const dynamic='force-dynamic';

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??'':value??'';

export default async function NewIntakePage({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>
}){
  const actor=await requireAdminPageActor();
  const q=await searchParams;
  const productId=first(q.productId);
  const offerId=first(q.offerId);
  const expected=Number(first(q.version));
  const error=first(q.error);

  const repos=adminRepositories();
  let product=null;
  let facets={salesChannels:[] as string[],assignees:[] as string[]};

  try{
    const [found,applications]=await Promise.all([
      productId?repos.products.get(productId):Promise.resolve(null),
      repos.applications.list(),
    ]);
    product=found;
    facets=applicationFacets(applications);
  }catch{}

  const offer=product?.offers.find((x)=>x.id===offerId)??null;
  const version=product?.version??(Number.isFinite(expected)?expected:0);
  const assignees=[actor.id,...facets.assignees.filter((value)=>value!==actor.id)];

  return <main className="admin-shell">
    <header className="topbar">
      <div><strong>freepasserp.com</strong><span>admin · 신규접수</span></div>
      <nav><Link href="/products">상품</Link><Link href="/intake">접수</Link><Link href="/settlement">정산</Link></nav>
      <div className="admin-user"><LogoutButton/></div>
    </header>

    <section className="workspace">
      <section className="panel product-panel">
        <div className="panel-head"><div><p className="eyebrow">PRODUCT</p><h1>접수 상품</h1></div></div>
        {product&&offer
          ?<div className="selected-offer-card">
            <span>Snapshot 대상</span>
            <h2>{product.vehicle.modelId}</h2>
            <p>{product.supplierId} · product v{product.version}</p>
            <b>{offer.termMonths}개월 · 월 {offer.monthlyRent.toLocaleString('ko-KR')}원</b>
            <small>접수 저장 시 이 상품판과 Offer가 Snapshot으로 고정됩니다.</small>
          </div>
          :<p>상품/Offer를 찾을 수 없습니다. <Link href="/products">상품찾기</Link>에서 다시 선택하세요.</p>}
      </section>

      <section className="panel detail-panel">
        <div className="panel-head"><div><p className="eyebrow">CONDITION</p><h1>계약조건</h1></div></div>
        {offer?<dl className="summary-grid">
          <div><dt>기간</dt><dd>{offer.termMonths}개월</dd></div>
          <div><dt>월 대여료</dt><dd>{offer.monthlyRent.toLocaleString('ko-KR')}원</dd></div>
          <div><dt>보증금</dt><dd>{typeof offer.deposit==='number'?offer.deposit.toLocaleString('ko-KR')+'원':'미확인'}</dd></div>
          <div><dt>주행거리</dt><dd>{offer.annualMileageKm?.toLocaleString('ko-KR')??'미확인'} km/년</dd></div>
        </dl>:null}

        <div className="work-hint">
          <b>접수 필수값</b>
          <span>선택 Offer · 영업채널 · 담당자 · 고객명입니다. 연락처는 최초 접수에서 선택값입니다.</span>
        </div>
      </section>

      <section className="panel work-panel">
        <div className="panel-head"><div><p className="eyebrow">NEW APPLICATION</p><h1>신규 접수</h1></div><Link className="icon-btn" href="/intake">목록</Link></div>
        {error&&<p>{error}</p>}

        {product&&offer?<form action={submitIntake} className="form-stack">
          <input type="hidden" name="productId" value={product.id}/>
          <input type="hidden" name="offerId" value={offer.id}/>
          <input type="hidden" name="expectedProductVersion" value={version}/>
          <input type="hidden" name="submissionId" value={randomUUID()}/>

          <label>
            영업채널
            <input name="salesChannelId" list="sales-channel-options" required placeholder="기존 채널 선택 또는 새 ID 입력"/>
            <datalist id="sales-channel-options">
              {facets.salesChannels.map((value)=><option key={value} value={value}/>)}
            </datalist>
          </label>

          <label>
            담당자
            <input name="assigneeId" list="assignee-options" required defaultValue={actor.id}/>
            <datalist id="assignee-options">
              {assignees.map((value)=><option key={value} value={value}/>)}
            </datalist>
          </label>

          <label>고객명<input name="applicantName" required/></label>
          <label>연락처 (선택)<input name="applicantPhone" inputMode="tel"/></label>

          <button className="primary" type="submit">접수 저장</button>
        </form>:null}

        <div className="work-hint">
          <b>후보값 원칙</b>
          <span>채널/담당자 후보는 별도 Master를 추측하지 않고 현재 접수 원장에 이미 존재하는 값만 보여줍니다.</span>
        </div>
      </section>
    </section>
  </main>;
}
