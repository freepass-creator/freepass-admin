import Link from 'next/link';
import { matchProduct } from '../../domain/search/match-product';
import type { ProductSearchQuery } from '../../domain/search/types';
import { resolveOfferPolicies } from '../../domain/product/resolve-policies';
import { adminRepositories } from '../../server/admin-runtime';

import { requireAdminPageActor } from '../../server/auth/page-guard';
import { LogoutButton } from '../_auth/LogoutButton';
export const dynamic='force-dynamic';

const PAGE_SIZE=50;
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??'':value??'';
const n=(value:string)=>{if(!value.trim())return undefined;const x=Number(value);return Number.isFinite(x)?x:undefined;};
const positiveInt=(value:string,fallback=1)=>{const x=Number(value);return Number.isInteger(x)&&x>0?x:fallback;};
const won=(value:number|undefined)=>typeof value==='number'?value.toLocaleString('ko-KR')+'원':'미확인';

export default async function ProductsPage({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>
}){
  await requireAdminPageActor();
  const q=await searchParams;
  const text=first(q.q).trim().toLowerCase();
  const term=n(first(q.term));
  const maxRent=n(first(q.maxRent));
  const maxDeposit=n(first(q.maxDeposit));
  const requestedPage=positiveInt(first(q.page));
  const selectedId=first(q.id);
  const selectedOfferId=first(q.offerId);
  const activeFilterCount=[term,maxRent,maxDeposit].filter((value)=>value!==undefined).length;

  let all;
  try{
    all=await adminRepositories().products.list();
  }catch(error){
    return <main className="admin-shell"><header className="topbar"><div><strong>freepasserp.com</strong><span>admin</span></div></header><section className="panel"><h1>상품 찾기</h1><p>{(error as Error).message}</p></section></main>;
  }

  const query:ProductSearchQuery={
    ...(term?{termMonths:[term]}:{}),
    ...(maxRent!==undefined?{monthlyRent:{max:maxRent}}:{}),
    ...(maxDeposit!==undefined?{deposit:{max:maxDeposit}}:{}),
  };

  const matches=all
    .filter((product)=>!text || [
      product.id,product.supplierId,product.supplierProductKey,
      ...product.offers.map((offer)=>offer.supplierId),
      product.vehicle.manufacturerId,product.vehicle.modelId,
      product.vehicle.subModelId,product.vehicle.trimId,
    ].filter(Boolean).join(' ').toLowerCase().includes(text))
    .map((product)=>matchProduct(product,query))
    .filter((x):x is NonNullable<typeof x>=>!!x);

  const totalPages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));
  const page=Math.min(requestedPage,totalPages);
  const visible=matches.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);

  const selected=matches.find((x)=>x.product.id===selectedId)??visible[0]??null;
  const offer=selected
    ? selected.matchedOffers.find((x)=>x.id===selectedOfferId)??selected.matchedOffers[0]??null
    : null;

  const href=(extra:Record<string,string>)=>{
    const p=new URLSearchParams();
    for(const [k,v] of Object.entries({q:first(q.q),term:first(q.term),maxRent:first(q.maxRent),maxDeposit:first(q.maxDeposit),page:String(page),...extra})){
      if(v)p.set(k,v);
    }
    return '/products?'+p.toString();
  };

  return <main className="admin-shell">
    <header className="topbar">
      <div><strong>freepasserp.com</strong><span>admin · 실제 Repository</span></div>
      <nav><Link href="/products">상품</Link><Link href="/intake">접수</Link><Link href="/settlement">정산</Link></nav>
      <div className="admin-user"><LogoutButton/></div>
    </header>
    <section className="workspace">
      <section className="panel product-panel">
        <div className="panel-head"><div><p className="eyebrow">PRODUCT</p><h1>상품 찾기</h1></div><span className="count">{matches.length}건 · {page}/{totalPages}</span></div>
        <form className="ui-search-discovery" data-ui-search-mode="search-filter">
          <div data-ui-search-row>
            <input
              className="ui-search"
              name="q"
              defaultValue={first(q.q)}
              aria-label="상품 검색"
              placeholder="차량 · 공급사 · 상품키 검색"
            />
            <details className="product-filter">
              <summary data-ui-filter-trigger>세부필터{activeFilterCount>0?` ${activeFilterCount}`:''}</summary>
              <div className="product-filter-panel">
                <label>기간(개월)<input name="term" inputMode="numeric" defaultValue={first(q.term)} /></label>
                <label>월 대여료 상한<input name="maxRent" inputMode="numeric" defaultValue={first(q.maxRent)} /></label>
                <label>보증금 상한<input name="maxDeposit" inputMode="numeric" defaultValue={first(q.maxDeposit)} /></label>
                <div className="product-filter-actions">
                  <Link href={href({term:'',maxRent:'',maxDeposit:'',page:'1',id:'',offerId:''})}>초기화</Link>
                  <button className="primary" type="submit">필터 적용</button>
                </div>
              </div>
            </details>
          </div>
          {activeFilterCount>0&&<div data-ui-applied-filters aria-label="적용된 세부필터">
            {term!==undefined&&<Link href={href({term:'',page:'1',id:'',offerId:''})}>기간 {term}개월 ×</Link>}
            {maxRent!==undefined&&<Link href={href({maxRent:'',page:'1',id:'',offerId:''})}>월 {won(maxRent)} 이하 ×</Link>}
            {maxDeposit!==undefined&&<Link href={href({maxDeposit:'',page:'1',id:'',offerId:''})}>보증금 {won(maxDeposit)} 이하 ×</Link>}
          </div>}
        </form>
        <div className="list">
          {visible.map((m)=>{
            const o=m.matchedOffers[0];
            return <Link key={m.product.id} href={href({id:m.product.id,offerId:o?.id??''})} className={'product-row '+(m.product.id===selected?.product.id?'selected':'')}>
              <div className="thumb">{m.vehicleMatch.level}</div>
              <div className="grow">
                <div className="row-title"><strong>{m.product.vehicle.modelId}</strong><span>{m.product.vehicle.matchLevel}</span></div>
                <p>{[m.product.vehicle.subModelId,m.product.vehicle.trimId,o?.supplierId??m.product.supplierId].filter(Boolean).join(' · ')}</p>
                <div className="price"><b>월 {won(o?.monthlyRent)}</b><small>{o?.termMonths??'-'}개월</small></div>
              </div>
            </Link>;
          })}
          {matches.length===0&&<p>조건에 맞는 상품이 없습니다.</p>}
        </div>
        {totalPages>1&&<div className="quick-filters">
          {page>1&&<Link href={href({page:String(page-1),id:'',offerId:''})}>이전</Link>}
          <span>{page} / {totalPages}</span>
          {page<totalPages&&<Link href={href({page:String(page+1),id:'',offerId:''})}>다음</Link>}
        </div>}
      </section>

      <section className="panel detail-panel">
        <div className="panel-head"><div><p className="eyebrow">DETAIL</p><h1>상품 상세</h1></div></div>
        {selected&&offer?<>

          <div className="vehicle-title"><div><h2>{selected.product.vehicle.modelId}</h2><p>{offer.supplierId??selected.product.supplierId} · product v{selected.product.version}</p></div><span className="status-dot">{selected.vehicleMatch.level}</span></div>
          <dl className="summary-grid">
            <div><dt>기간</dt><dd>{offer.termMonths}개월</dd></div>
            <div><dt>월 대여료</dt><dd>{won(offer.monthlyRent)}</dd></div>
            <div><dt>보증금</dt><dd>{won(offer.deposit)}</dd></div>
            <div><dt>약정주행</dt><dd>{offer.annualMileageKm?.toLocaleString('ko-KR')??'미확인'} km/년</dd></div>
          </dl>
          <div className="offer-picker">
            {selected.matchedOffers.map((x)=><Link key={x.id} href={href({id:selected.product.id,offerId:x.id})} className={x.id===offer.id?'active':''}>
              {[x.supplierId??selected.product.supplierId,x.termMonths+'개월','월 '+won(x.monthlyRent)].filter(Boolean).join(' · ')}
            </Link>)}
          </div>
          <div className="chips">
            {resolveOfferPolicies(selected.product,offer).map((p)=><span key={p.policyId}>{p.policyId}: {Array.isArray(p.value)?p.value.join(', '):String(p.value)}</span>)}
          </div>
          <Link className="primary" href={'/intake/new?productId='+encodeURIComponent(selected.product.id)+'&offerId='+encodeURIComponent(offer.id)+'&version='+selected.product.version}>이 상품 접수하기</Link>
        </>:<p>왼쪽에서 상품을 선택하세요.</p>}
      </section>

      <section className="panel work-panel">
        <div className="panel-head"><div><p className="eyebrow">WORK</p><h1>접수</h1></div></div>
        <p>검색에서 선택한 Offer 그대로 접수 Snapshot으로 넘깁니다.</p>
        <Link className="primary" href="/intake">접수 목록 보기</Link>
      </section>
    </section>
  </main>;
}
