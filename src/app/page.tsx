'use client';

import { useMemo, useState } from 'react';

type Product = {
  id: string;
  name: string;
  sub: string;
  supplier: string;
  match: string;
  offers: {
    id: string;
    term: number;
    rent: number;
    deposit: number;
    mileage: number;
    policies: string[];
  }[];
};

type AppItem = {
  id: string;
  no: string;
  customer: string;
  phone: string;
  productId: string;
  vehicle: string;
  offer: Product['offers'][number];
  contract: boolean;
  docs: boolean;
  delivery: boolean;
  cancelled: boolean;
};

type MobileView = 'products' | 'detail' | 'work';
type WorkView = 'list' | 'new' | 'detail';

const PRODUCTS: Product[] = [
  { id:'p1', name:'쏘나타', sub:'세부모델 미확인', supplier:'A 렌터카', match:'모델', offers:[{id:'p1-36',term:36,rent:690000,deposit:0,mileage:20000,policies:['만 21세 가능','후불']}] },
  { id:'p2', name:'싼타페 MX5', sub:'캘리그래피', supplier:'B 렌터카', match:'세부트림', offers:[{id:'p2-24',term:24,rent:990000,deposit:1000000,mileage:20000,policies:['카드결제']},{id:'p2-36',term:36,rent:920000,deposit:0,mileage:20000,policies:['만 21세 가능','카드결제','보증금 분납']}] },
  { id:'p3', name:'K5', sub:'더 뉴 K5 DL3 · 노블레스', supplier:'C 렌터카', match:'세부트림', offers:[{id:'p3-24',term:24,rent:780000,deposit:0,mileage:30000,policies:['후불','카드결제']}] },
  { id:'p4', name:'GV80', sub:'세부트림 미확인', supplier:'D 렌터카', match:'세부모델', offers:[{id:'p4-48',term:48,rent:1090000,deposit:2000000,mileage:20000,policies:['보증금 분납']}] },
];

const INITIAL_APPS: AppItem[] = [
  {id:'a1',no:'A-260913-014',customer:'김OO',phone:'010-0000-0014',productId:'p2',vehicle:'싼타페 MX5',offer:PRODUCTS[1].offers[1],contract:true,docs:true,delivery:false,cancelled:false},
  {id:'a2',no:'A-260913-013',customer:'이OO',phone:'010-0000-0013',productId:'p3',vehicle:'K5',offer:PRODUCTS[2].offers[0],contract:true,docs:false,delivery:false,cancelled:false},
  {id:'a3',no:'A-260912-041',customer:'박OO',phone:'010-0000-0041',productId:'p4',vehicle:'GV80',offer:PRODUCTS[3].offers[0],contract:true,docs:true,delivery:true,cancelled:false},
];

const money=(n:number)=>`${n.toLocaleString('ko-KR')}원`;

export default function AdminHome(){
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState('p2');
  const [offerId,setOfferId]=useState('p2-36');
  const [work,setWork]=useState<WorkView>('list');
  const [apps,setApps]=useState<AppItem[]>(INITIAL_APPS);
  const [activeAppId,setActiveAppId]=useState<string|null>(null);
  const [customer,setCustomer]=useState('');
  const [phone,setPhone]=useState('');
  const [mobileView,setMobileView]=useState<MobileView>('products');

  const filtered=useMemo(
    ()=>PRODUCTS.filter((p)=>`${p.name} ${p.sub} ${p.supplier} ${p.offers.flatMap((o)=>o.policies).join(' ')}`.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const selected=PRODUCTS.find((p)=>p.id===selectedId)??PRODUCTS[0];
  const selectedOffer=selected.offers.find((o)=>o.id===offerId)??selected.offers[0];
  const activeApp=apps.find((a)=>a.id===activeAppId)??null;

  function selectProduct(p:Product){
    setSelectedId(p.id);
    setOfferId(p.offers[0].id);
    setMobileView('detail');
  }

  function openNew(){
    setCustomer('');
    setPhone('');
    setWork('new');
    setMobileView('work');
  }

  function submitApplication(){
    if(!customer.trim()||!phone.trim()) return;
    const stamp=String(apps.length+15).padStart(3,'0');
    const app:AppItem={
      id:`a-${Date.now()}`,
      no:`A-260913-${stamp}`,
      customer:customer.trim(),
      phone:phone.trim(),
      productId:selected.id,
      vehicle:selected.name,
      offer:{...selectedOffer,policies:[...selectedOffer.policies]},
      contract:false,
      docs:false,
      delivery:false,
      cancelled:false
    };
    setApps((v)=>[app,...v]);
    setActiveAppId(app.id);
    setWork('detail');
  }

  function openApp(app:AppItem){
    setActiveAppId(app.id);
    setWork('detail');
    setMobileView('work');
  }

  function patchApp(key:'contract'|'docs'|'delivery'){
    if(!activeApp||activeApp.cancelled) return;
    setApps((v)=>v.map((a)=>a.id===activeApp.id?{...a,[key]:!a[key]}:a));
  }

  function cancelApp(){
    if(!activeApp) return;
    setApps((v)=>v.map((a)=>a.id===activeApp.id?{...a,cancelled:true}:a));
  }

  function openApplications(){
    setWork('list');
    setMobileView('work');
  }

  return (
    <main className="admin-shell">
      <aside className="rail" aria-label="관리자 업무">
        <div className="brand">
          <strong>FREEPASS</strong>
          <span>ADMIN</span>
        </div>
        <nav className="rail-nav">
          <button className="active" onClick={()=>setMobileView('products')}>상품</button>
          <button onClick={openApplications}>접수 <span>{apps.length}</span></button>
          <button aria-disabled="true">실적</button>
          <button aria-disabled="true">정산</button>
        </nav>
        <div className="rail-user">
          <b>관리자</b>
          <span>internal workspace</span>
        </div>
      </aside>

      <section className="workspace">
        <section className={`panel product-panel ${mobileView==='products'?'mobile-active':''}`}>
          <header className="panel-head">
            <div>
              <p className="eyebrow">PRODUCT</p>
              <h1>상품 찾기</h1>
            </div>
            <span className="count">{filtered.length}건</span>
          </header>

          <div className="searchline">
            <label className="searchbox">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
                placeholder="차종·기간·보증금·연령 조건 검색"
                aria-label="상품 검색"
              />
            </label>
            <button className="secondary-control" type="button">세부필터</button>
          </div>

          {query && <div className="query-hint"><span>검색어</span><b>{query}</b></div>}

          <div className="list" aria-label="상품 목록">
            {filtered.map((p)=>{
              const offer=p.offers[0];
              return (
                <button key={p.id} onClick={()=>selectProduct(p)} className={`product-row ${p.id===selected.id?'selected':''}`}>
                  <div className="thumb"><span>사진 준비 중</span></div>
                  <div className="grow">
                    <div className="row-title">
                      <strong>{p.name}</strong>
                      <span>{p.match}</span>
                    </div>
                    <p>{p.sub}</p>
                    <div className="price">
                      <b>월 {money(offer.rent)}</b>
                      <small>{offer.term}개월</small>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className={`panel detail-panel ${mobileView==='detail'?'mobile-active':''}`}>
          <header className="panel-head">
            <div>
              <p className="eyebrow">DETAIL</p>
              <h1>상품 상세</h1>
            </div>
            <span className="status">판매중</span>
          </header>

          <div className="hero-car">
            <span>사진 준비 중</span>
            <small>{selected.supplier}</small>
          </div>

          <div className="vehicle-title">
            <div>
              <h2>{selected.name}</h2>
              <p>{selected.sub}</p>
            </div>
            <span className="match">{selected.match}</span>
          </div>

          <dl className="facts">
            <dt>공급사</dt><dd>{selected.supplier}</dd>
            <dt>차종 매칭</dt><dd>{selected.match}</dd>
            <dt>선택 보증금</dt><dd>{money(selectedOffer.deposit)}</dd>
            <dt>약정주행</dt><dd>연 {selectedOffer.mileage.toLocaleString()}km</dd>
          </dl>

          <div className="section-title">
            <b>대여 조건</b>
            <span>한 Offer의 조건을 함께 선택합니다.</span>
          </div>

          <div className="offer-list">
            {selected.offers.map((o)=>(
              <button
                key={o.id}
                onClick={()=>setOfferId(o.id)}
                className={`offer-row ${o.id===selectedOffer.id?'active':''}`}
              >
                <div>
                  <strong>{o.term}개월</strong>
                  <span>월 {money(o.rent)}</span>
                </div>
                <dl>
                  <div><dt>보증금</dt><dd>{money(o.deposit)}</dd></div>
                  <div><dt>약정주행</dt><dd>연 {o.mileage.toLocaleString()}km</dd></div>
                </dl>
                <p>{o.policies.join(' · ')}</p>
              </button>
            ))}
          </div>

          <div className="detail-actions">
            <button className="secondary-control" type="button">공유</button>
            <button className="primary" onClick={openNew}>이 상품 접수하기</button>
          </div>
        </section>

        <section className={`panel work-panel ${mobileView==='work'?'mobile-active':''}`}>
          {work==='list'&&(
            <>
              <header className="panel-head">
                <div>
                  <p className="eyebrow">APPLICATION</p>
                  <h1>접수 목록</h1>
                </div>
                <button className="primary compact" onClick={openNew}>신규접수</button>
              </header>

              <div className="work-summary">
                <span>전체 <b>{apps.length}</b></span>
                <span>진행중 <b>{apps.filter((a)=>!a.delivery&&!a.cancelled).length}</b></span>
                <span>인도완료 <b>{apps.filter((a)=>a.delivery).length}</b></span>
              </div>

              <div className="application-list">
                {apps.map((app)=>(
                  <button className="application-row" key={app.id} onClick={()=>openApp(app)}>
                    <div>
                      <strong>{app.customer}</strong>
                      <span>{app.no}</span>
                    </div>
                    <b>{app.vehicle}</b>
                    <p>{app.cancelled?'취소':app.delivery?'인도완료':app.contract?'진행중':'신규 접수'}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {work==='new'&&(
            <>
              <header className="panel-head">
                <div>
                  <p className="eyebrow">NEW APPLICATION</p>
                  <h1>신규 접수</h1>
                </div>
                <button className="secondary-control" onClick={()=>setWork('list')}>목록</button>
              </header>

              <div className="selected-offer-card">
                <span>선택 상품</span>
                <h2>{selected.name}</h2>
                <p>{selected.sub}</p>
                <b>{selectedOffer.term}개월 · 월 {money(selectedOffer.rent)}</b>
                <small>저장 시 선택 Offer Snapshot을 보존합니다.</small>
              </div>

              <div className="form-stack">
                <label>고객명<input value={customer} onChange={(e)=>setCustomer(e.target.value)} placeholder="고객명"/></label>
                <label>연락처<input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="010-0000-0000"/></label>
              </div>

              <div className="detail-actions">
                <button className="secondary-control" onClick={()=>setWork('list')}>취소</button>
                <button className="primary" onClick={submitApplication}>접수 저장</button>
              </div>
            </>
          )}

          {work==='detail'&&activeApp&&(
            <>
              <header className="panel-head">
                <div>
                  <p className="eyebrow">APPLICATION</p>
                  <h1>접수 상세</h1>
                </div>
                <button className="secondary-control" onClick={()=>setWork('list')}>목록</button>
              </header>

              <div className="application-detail-head">
                <span>{activeApp.no}</span>
                <h2>{activeApp.customer}</h2>
                <p>{activeApp.vehicle} · {activeApp.phone}</p>
              </div>

              <div className="snapshot-box">
                <span>접수 당시 조건</span>
                <b>{activeApp.offer.term}개월 · 월 {money(activeApp.offer.rent)}</b>
                <p>보증금 {money(activeApp.offer.deposit)} · 연 {activeApp.offer.mileage.toLocaleString()}km</p>
              </div>

              <div className="progress-actions">
                <button className={activeApp.contract?'done':''} onClick={()=>patchApp('contract')}>계약서 {activeApp.contract?'완료':'대기'}</button>
                <button className={activeApp.docs?'done':''} onClick={()=>patchApp('docs')}>필수서류 {activeApp.docs?'완료':'대기'}</button>
                <button className={activeApp.delivery?'done':''} onClick={()=>patchApp('delivery')}>인도 {activeApp.delivery?'완료':'대기'}</button>
              </div>

              <div className={`application-status ${activeApp.cancelled?'cancelled':''}`}>
                {activeApp.cancelled?'취소':activeApp.delivery?'인도완료':activeApp.contract?'진행중':'접수완료'}
              </div>

              {!activeApp.cancelled&&(
                <button className="danger-link" onClick={cancelApp}>접수 취소</button>
              )}
            </>
          )}
        </section>
      </section>

      <nav className="mobile-nav" aria-label="모바일 화면 전환">
        <button className={mobileView==='products'?'active':''} onClick={()=>setMobileView('products')}>상품</button>
        <button className={mobileView==='detail'?'active':''} onClick={()=>setMobileView('detail')}>상세</button>
        <button className={mobileView==='work'?'active':''} onClick={openApplications}>접수</button>
      </nav>
    </main>
  );
}
