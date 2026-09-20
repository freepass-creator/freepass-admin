import Link from 'next/link';
import type { CanonicalProduct } from '../../domain/product/types';
import { firstOfferForTerm, offerTerms, offersForTerm } from '../../domain/product/offer-terms';
import { resolveOfferPolicies } from '../../domain/product/resolve-policies';
import { matchProduct } from '../../domain/search/match-product';
import type { ProductSearchQuery } from '../../domain/search/types';
import { adminRepositories } from '../../server/admin-runtime';
import { requireAdminPageActor } from '../../server/auth/page-guard';
import { LogoutButton } from '../_auth/LogoutButton';
import { ProductFilterSheet, type FilterAxis } from './ProductFilterSheet';
import { ShareButton } from './ShareButton';

export const dynamic='force-dynamic';

const PAGE_SIZE=50;
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??'':value??'';
const n=(value:string)=>{if(!value.trim())return undefined;const x=Number(value);return Number.isFinite(x)?x:undefined;};
const positiveInt=(value:string,fallback=1)=>{const x=Number(value);return Number.isInteger(x)&&x>0?x:fallback;};
const won=(value:number|undefined)=>typeof value==='number'?value.toLocaleString('ko-KR')+'원':'미확인';
const depositLabel=(offer:{deposit?:number;depositState?:string})=>{
  if(offer.depositState==='NOT_APPLICABLE')return '해당없음';
  if(offer.depositState==='UNKNOWN')return '미확인';
  if(offer.depositState==='ZERO')return '0원';
  return won(offer.deposit);
};
const uniq=(values:(number|undefined)[])=>[...new Set(values.filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)))].sort((a,b)=>a-b);
const safeImage=(url:string|undefined)=>url&&/^https?:\/\//i.test(url)?url:undefined;

function ProductPhoto({
  product,
  supplier,
  matchLabel,
  hero=false,
}:{
  product:CanonicalProduct;
  supplier:string;
  matchLabel:string;
  hero?:boolean;
}){
  const src=safeImage(product.media?.primaryImageUrl);
  return <div className={'product-photo '+(hero?'hero':'')}>
    {src?<>
      <img src={src} alt={product.vehicle.modelId+' 차량 사진'}/>
      <div className="photo-sig"><span>{supplier}</span><span>{matchLabel}</span></div>
    </>:<div className="no-photo"><span className="no-photo-icon">▤</span><span>사진 준비 중</span></div>}
  </div>;
}

export default async function ProductsPage({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>
}){
  await requireAdminPageActor();
  const q=await searchParams;
  const rawText=first(q.q);
  const text=rawText.trim().toLowerCase();
  const term=n(first(q.term));
  const maxRent=n(first(q.maxRent));
  const maxDeposit=n(first(q.maxDeposit));
  const mileage=n(first(q.mileage));
  const requestedPage=positiveInt(first(q.page));
  const selectedId=first(q.id);
  const selectedOfferId=first(q.offerId);
  const activeFilterCount=[term,maxRent,maxDeposit,mileage].filter((value)=>value!==undefined).length;

  let all:CanonicalProduct[];
  try{
    all=await adminRepositories().products.list();
  }catch(error){
    return <main className="admin-shell"><header className="topbar"><div><strong>freepasserp.com</strong><span>admin</span></div></header><section className="panel"><h1>상품 찾기</h1><p>{(error as Error).message}</p></section></main>;
  }

  const textMatches=(product:CanonicalProduct)=>!text || [
    product.id,product.supplierId,product.supplierProductKey,
    ...product.offers.map((offer)=>offer.supplierId),
    product.vehicle.manufacturerId,product.vehicle.modelId,
    product.vehicle.subModelId,product.vehicle.trimId,
  ].filter(Boolean).join(' ').toLowerCase().includes(text);

  const queryFor=(values:{
    term?:number;
    maxRent?:number;
    maxDeposit?:number;
    mileage?:number;
  }):ProductSearchQuery=>({
    ...(values.term!==undefined?{termMonths:[values.term]}:{}),
    ...(values.maxRent!==undefined?{monthlyRent:{max:values.maxRent}}:{}),
    ...(values.maxDeposit!==undefined?{deposit:{max:values.maxDeposit}}:{}),
    ...(values.mileage!==undefined?{annualMileageKm:{min:values.mileage,max:values.mileage}}:{}),
  });

  const query=queryFor({term,maxRent,maxDeposit,mileage});
  const matches=all
    .filter(textMatches)
    .map((product)=>matchProduct(product,query))
    .filter((x):x is NonNullable<typeof x>=>!!x);

  const countFor=(values:{term?:number;maxRent?:number;maxDeposit?:number;mileage?:number})=>
    all.filter(textMatches).filter((product)=>!!matchProduct(product,queryFor(values))).length;

  const allOffers=all.flatMap((product)=>product.offers);
  const termValues=offerTerms(allOffers);
  const rentValues=uniq(allOffers.map((offer)=>offer.monthlyRent));
  const depositValues=uniq(allOffers.map((offer)=>offer.deposit));
  const mileageValues=uniq(allOffers.map((offer)=>offer.annualMileageKm));
  const filterAxes:FilterAxis[]=[
    {
      key:'term',label:'대여기간',
      options:termValues.map((value)=>({
        value:String(value),label:value+'개월',
        count:countFor({term:value,maxRent,maxDeposit,mileage}),
      })),
    },
    {
      key:'maxRent',label:'월 대여료',
      options:rentValues.map((value)=>({
        value:String(value),label:won(value)+' 이하',
        count:countFor({term,maxRent:value,maxDeposit,mileage}),
      })),
    },
    {
      key:'maxDeposit',label:'보증금',
      options:depositValues.map((value)=>({
        value:String(value),label:value===0?'무보증 (0원)':won(value)+' 이하',
        count:countFor({term,maxRent,maxDeposit:value,mileage}),
      })),
    },
    {
      key:'mileage',label:'약정주행',
      options:mileageValues.map((value)=>({
        value:String(value),label:'연 '+value.toLocaleString('ko-KR')+'km',
        count:countFor({term,maxRent,maxDeposit,mileage:value}),
      })),
    },
  ];

  const totalPages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));
  const page=Math.min(requestedPage,totalPages);
  const visible=matches.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const explicitSelected=matches.find((x)=>x.product.id===selectedId)??null;
  const selected=explicitSelected??visible[0]??null;
  const offer=selected
    ?selected.matchedOffers.find((x)=>x.id===selectedOfferId)??selected.matchedOffers[0]??null
    :null;
  const availableTerms=selected?offerTerms(selected.matchedOffers):[];
  const selectedTerm=offer?.termMonths;
  const termOffers=selectedTerm!==undefined&&selected
    ?offersForTerm(selected.matchedOffers,selectedTerm)
    :[];
  const mobileView=explicitSelected?'detail':'list';

  const href=(extra:Record<string,string>)=>{
    const p=new URLSearchParams();
    for(const [k,v] of Object.entries({
      q:rawText,
      term:first(q.term),
      maxRent:first(q.maxRent),
      maxDeposit:first(q.maxDeposit),
      mileage:first(q.mileage),
      page:String(page),
      ...extra,
    })){
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

    <section className="workspace products-workspace ui-master-detail" data-mobile-view={mobileView}>
      <section className="panel product-panel" data-ui-master-detail-pane data-pane="list">
        <div className="panel-head"><div><p className="eyebrow">PRODUCT</p><h1>상품 찾기</h1></div><span className="count">{matches.length}건 · {page}/{totalPages}</span></div>

        <form className="ui-search-discovery" data-ui-search-mode="search-filter">
          <div data-ui-search-row>
            <input
              className="ui-search"
              name="q"
              defaultValue={rawText}
              aria-label="상품 검색"
              placeholder="차량 · 공급사 · 상품키 검색"
            />
            <ProductFilterSheet axes={filterAxes} activeCount={activeFilterCount} resultCount={matches.length}/>
          </div>
          {activeFilterCount>0&&<div data-ui-applied-filters aria-label="적용된 세부필터">
            {term!==undefined&&<Link href={href({term:'',page:'1',id:'',offerId:''})}>기간 {term}개월 ×</Link>}
            {maxRent!==undefined&&<Link href={href({maxRent:'',page:'1',id:'',offerId:''})}>월 {won(maxRent)} 이하 ×</Link>}
            {maxDeposit!==undefined&&<Link href={href({maxDeposit:'',page:'1',id:'',offerId:''})}>보증금 {won(maxDeposit)} 이하 ×</Link>}
            {mileage!==undefined&&<Link href={href({mileage:'',page:'1',id:'',offerId:''})}>연 {mileage.toLocaleString('ko-KR')}km ×</Link>}
          </div>}
        </form>

        <div className="list product-list">
          {visible.map((m)=>{
            const o=m.matchedOffers[0];
            const supplier=o?.supplierId??m.product.supplierId;
            return <Link
              key={m.product.id}
              href={href({id:m.product.id,offerId:o?.id??''})}
              scroll={false}
              className={'product-row '+(m.product.id===selected?.product.id?'selected':'')}
            >
              <ProductPhoto product={m.product} supplier={supplier} matchLabel={m.vehicleMatch.level}/>
              <div className="grow">
                <div className="row-title"><strong>{m.product.vehicle.modelId}</strong><b className="price-inline">월 {won(o?.monthlyRent)}</b></div>
                <p>{[m.product.vehicle.subModelId,m.product.vehicle.trimId].filter(Boolean).join(' · ')||'상세정보 미확인'}</p>
                <div className="row-meta">
                  <span>{offerTerms(m.matchedOffers).map((months)=>months+'개월').join(' · ')}</span>
                  <span>{supplier}</span>
                </div>
              </div>
            </Link>;
          })}
          {matches.length===0&&<div className="empty-state"><b>조건에 맞는 상품이 없습니다.</b><span>검색어나 세부필터를 조정해 보세요.</span></div>}
        </div>

        {totalPages>1&&<div className="quick-filters pagination-row">
          {page>1&&<Link href={href({page:String(page-1),id:'',offerId:''})}>이전</Link>}
          <span>{page} / {totalPages}</span>
          {page<totalPages&&<Link href={href({page:String(page+1),id:'',offerId:''})}>다음</Link>}
        </div>}
      </section>

      <section className="panel detail-panel" data-ui-master-detail-pane data-pane="detail">
        <div className="panel-head mobile-detail-head">
          <Link className="mobile-detail-back" href={href({id:'',offerId:''})} scroll={false} aria-label="상품 목록으로 돌아가기">‹</Link>
          <div><p className="eyebrow">DETAIL</p><h1>상품 상세</h1></div>
        </div>

        {selected&&offer?<>
          <ProductPhoto
            product={selected.product}
            supplier={offer.supplierId??selected.product.supplierId}
            matchLabel={selected.vehicleMatch.level}
            hero
          />

          <div className="vehicle-title"><div><h2>{selected.product.vehicle.modelId}</h2><p>{[selected.product.vehicle.subModelId,selected.product.vehicle.trimId].filter(Boolean).join(' · ')||'상세정보 미확인'}</p></div></div>

          <nav className="ui-variant-selector term-picker" aria-label="계약기간 선택">
            {availableTerms.map((months)=>{
              const target=firstOfferForTerm(selected.matchedOffers,months);
              return <Link
                key={months}
                href={href({id:selected.product.id,offerId:target?.id??''})}
                scroll={false}
                aria-current={months===selectedTerm?'true':undefined}
                className={months===selectedTerm?'active':''}
              >{months}개월</Link>;
            })}
          </nav>

          <div className="term-offer-list">
            {termOffers.map((x)=>{
              const policies=resolveOfferPolicies(selected.product,x);
              return <Link
                key={x.id}
                href={href({id:selected.product.id,offerId:x.id})}
                scroll={false}
                className={'term-offer-row '+(x.id===offer.id?'selected':'')}
              >
                <div>
                  <strong>월 {won(x.monthlyRent)}</strong>
                  <span>{x.supplierId??selected.product.supplierId}</span>
                </div>
                <dl>
                  <div><dt>주행거리</dt><dd>{x.annualMileageKm?.toLocaleString('ko-KR')??'미확인'} km/년</dd></div>
                  <div><dt>보증금</dt><dd>{depositLabel(x)}</dd></div>
                  <div><dt>선납금</dt><dd>{won(x.prepayment)}</dd></div>
                </dl>
                {policies.length>0&&<p>{policies.map((p)=>p.policyId+': '+(Array.isArray(p.value)?p.value.join(', '):String(p.value))).join(' · ')}</p>}
              </Link>;
            })}
          </div>

          <dl className="summary-grid">
            <div><dt>선택 기간</dt><dd>{offer.termMonths}개월</dd></div>
            <div><dt>월 대여료</dt><dd>{won(offer.monthlyRent)}</dd></div>
            <div><dt>보증금</dt><dd>{depositLabel(offer)}</dd></div>
            <div><dt>약정주행</dt><dd>{offer.annualMileageKm?.toLocaleString('ko-KR')??'미확인'} km/년</dd></div>
          </dl>

          <div className="chips">
            {resolveOfferPolicies(selected.product,offer).map((p)=><span key={p.policyId}>{p.policyId}: {Array.isArray(p.value)?p.value.join(', '):String(p.value)}</span>)}
          </div>

          <div className="product-action-dock">
            <ShareButton title={selected.product.vehicle.modelId+' 상품'}/>
            <Link className="btn primary" href={'/intake/new?productId='+encodeURIComponent(selected.product.id)+'&offerId='+encodeURIComponent(offer.id)+'&version='+selected.product.version}>이 조건으로 접수하기</Link>
          </div>
        </>:<p>상품을 선택하세요.</p>}
      </section>

      <section className="panel work-panel" data-ui-master-detail-pane data-pane="work">
        <div className="panel-head"><div><p className="eyebrow">WORK</p><h1>접수</h1></div></div>
        <p>검색에서 선택한 Offer 그대로 접수 Snapshot으로 넘깁니다.</p>
        <Link className="primary" href="/intake">접수 목록 보기</Link>
      </section>
    </section>
  </main>;
}
