import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { resolveOfferPolicies } from '../../../domain/product/resolve-policies';
import { adminReferenceMaster } from '../../../server/admin-masters';
import { adminRepositories } from '../../../server/admin-runtime';
import { requireAdminPageActor } from '../../../server/auth/page-guard';
import { LogoutButton } from '../../_auth/LogoutButton';
import { submitIntake } from '../actions';

export const dynamic='force-dynamic';

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??'':value??'';
const depositLabel=(offer:{deposit?:number;depositState?:string})=>{
  if(offer.depositState==='NOT_APPLICABLE')return '해당없음';
  if(offer.depositState==='UNKNOWN')return '미확인';
  if(offer.depositState==='ZERO')return '0원';
  return typeof offer.deposit==='number'?offer.deposit.toLocaleString('ko-KR')+'원':'미확인';
};

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
  const master=adminReferenceMaster();

  let product=null;
  let salesChannels:{id:string;label:string}[]=[];
  let assignees:{id:string;label:string}[]=[];
  let masterError='';

  try{
    const [found,channels,staff]=await Promise.all([
      productId?repos.products.get(productId):Promise.resolve(null),
      master.listSalesChannels(),
      master.listAssignees(),
    ]);
    product=found;
    salesChannels=channels.filter((x)=>x.status==='ACTIVE');
    assignees=staff.filter((x)=>x.status==='ACTIVE');
  }catch(e){
    masterError=e instanceof Error?e.message:String(e);
  }

  const offer=product?.offers.find((x)=>x.id===offerId)??null;
  const version=product?.version??(Number.isFinite(expected)?expected:0);
  const defaultAssignee=assignees.some((x)=>x.id===actor.id)?actor.id:(assignees[0]?.id??'');

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
            <p>{offer.supplierId??product.supplierId} · product v{product.version}</p>
            <b>{offer.termMonths}개월 · 월 {offer.monthlyRent.toLocaleString('ko-KR')}원</b>
            <small>접수 저장 시 이 상품판과 Offer가 Snapshot으로 고정됩니다.</small>
          </div>
          :<p>상품/Offer를 찾을 수 없습니다. <Link href="/products">상품찾기</Link>에서 다시 선택하세요.</p>}
      </section>

      <section className="panel detail-panel">
        <div className="panel-head"><div><p className="eyebrow">CONDITION</p><h1>계약조건</h1></div></div>
        {offer?<><dl className="summary-grid">
          <div><dt>기간</dt><dd>{offer.termMonths}개월</dd></div>
          <div><dt>월 대여료</dt><dd>{offer.monthlyRent.toLocaleString('ko-KR')}원</dd></div>
          <div><dt>보증금</dt><dd>{depositLabel(offer)}</dd></div>
          <div><dt>주행거리</dt><dd>{offer.annualMileageKm?.toLocaleString('ko-KR')??'미확인'} km/년</dd></div>
          <div><dt>선납금</dt><dd>{typeof offer.prepayment==='number'?offer.prepayment.toLocaleString('ko-KR')+'원':'미확인'}</dd></div>
          <div><dt>공급사</dt><dd>{offer.supplierId??product?.supplierId??'미확인'}</dd></div>
        </dl>
        {product&&resolveOfferPolicies(product,offer).length>0&&<div className="chips">
          {resolveOfferPolicies(product,offer).map((p)=><span key={p.policyId}>{p.policyId}: {Array.isArray(p.value)?p.value.join(', '):String(p.value)}</span>)}
        </div>}</>:null}

        <div className="work-hint">
          <b>Reference Master</b>
          <span>영업채널은 ERP5 Partner Master의 활성 영업채널, 담당자는 현재 Auth Master의 활성 UID만 저장할 수 있습니다.</span>
        </div>
      </section>

      <section className="panel work-panel">
        <div className="panel-head"><div><p className="eyebrow">NEW APPLICATION</p><h1>신규 접수</h1></div><Link className="icon-btn" href="/intake">목록</Link></div>
        {error&&<p>{error}</p>}
        {masterError&&<p>{masterError}</p>}

        {product&&offer&&!masterError?<form action={submitIntake} className="form-stack">
          <input type="hidden" name="productId" value={product.id}/>
          <input type="hidden" name="offerId" value={offer.id}/>
          <input type="hidden" name="expectedProductVersion" value={version}/>
          <input type="hidden" name="submissionId" value={randomUUID()}/>

          <label>
            영업채널
            <select name="salesChannelId" required defaultValue="">
              <option value="" disabled>영업채널 선택</option>
              {salesChannels.map((value)=><option key={value.id} value={value.id}>{value.label} · {value.id}</option>)}
            </select>
          </label>

          <label>
            담당자
            <select name="assigneeId" required defaultValue={defaultAssignee}>
              {!defaultAssignee&&<option value="" disabled>담당자 선택</option>}
              {assignees.map((value)=><option key={value.id} value={value.id}>{value.label}</option>)}
            </select>
          </label>

          <label>고객명<input name="applicantName" required/></label>
          <label>연락처 (선택)<input name="applicantPhone" inputMode="tel"/></label>

          <button className="primary" type="submit" disabled={!salesChannels.length||!assignees.length}>접수 저장</button>
        </form>:null}

        {!masterError&&salesChannels.length===0&&<p>활성 영업채널 Master가 없습니다. 접수를 저장하지 않습니다.</p>}
        {!masterError&&assignees.length===0&&<p>활성 담당자 Master가 없습니다. 접수를 저장하지 않습니다.</p>}
      </section>
    </section>
  </main>;
}
