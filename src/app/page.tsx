'use client';

import { useMemo, useState } from 'react';

type Product = {
  id: string; name: string; sub: string; supplier: string; match: string;
  offers: { id: string; term: number; rent: number; deposit: number; mileage: number; policies: string[] }[];
};
type AppItem = {
  id: string; no: string; customer: string; phone: string; productId: string; vehicle: string;
  offer: Product['offers'][number]; contract: boolean; docs: boolean; delivery: boolean; cancelled: boolean;
};

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
  const [work,setWork]=useState<'list'|'new'|'detail'>('list');
  const [apps,setApps]=useState<AppItem[]>(INITIAL_APPS);
  const [activeAppId,setActiveAppId]=useState<string|null>(null);
  const [customer,setCustomer]=useState('');
  const [phone,setPhone]=useState('');

  const filtered=useMemo(()=>PRODUCTS.filter(p=>`${p.name} ${p.sub} ${p.supplier} ${p.offers.flatMap(o=>o.policies).join(' ')}`.toLowerCase().includes(query.toLowerCase())),[query]);
  const selected=PRODUCTS.find(p=>p.id===selectedId)??PRODUCTS[0];
  const selectedOffer=selected.offers.find(o=>o.id===offerId)??selected.offers[0];
  const activeApp=apps.find(a=>a.id===activeAppId)??null;

  function selectProduct(p:Product){setSelectedId(p.id);setOfferId(p.offers[0].id)}
  function openNew(){setCustomer('');setPhone('');setWork('new')}
  function submitApplication(){
    if(!customer.trim()||!phone.trim()) return;
    const stamp=String(apps.length+15).padStart(3,'0');
    const app:AppItem={id:`a-${Date.now()}`,no:`A-260913-${stamp}`,customer:customer.trim(),phone:phone.trim(),productId:selected.id,vehicle:selected.name,offer:{...selectedOffer,policies:[...selectedOffer.policies]},contract:false,docs:false,delivery:false,cancelled:false};
    setApps(v=>[app,...v]); setActiveAppId(app.id); setWork('detail');
  }
  function openApp(app:AppItem){setActiveAppId(app.id);setWork('detail')}
  function patchApp(key:'contract'|'docs'|'delivery'){if(!activeApp||activeApp.cancelled)return;setApps(v=>v.map(a=>a.id===activeApp.id?{...a,[key]:!a[key]}:a))}
  function cancelApp(){if(!activeApp)return;setApps(v=>v.map(a=>a.id===activeApp.id?{...a,cancelled:true}:a))}

  return <main className="admin-shell">
    <header className="topbar"><div><strong>freepasserp.com</strong><span>admin · v1</span></div><nav><button className="active">상품·접수</button><button>정산</button><button>설정</button></nav><div className="admin-user">관리자</div></header>
    <section className="workspace">
      <section className="panel product-panel">
        <div className="panel-head"><div><p className="eyebrow">PRODUCT</p><h1>상품 목록</h1></div><span className="count">{filtered.length}건</span></div>
        <label className="searchbox">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="모델, 조건, 정책 검색"/></label>
        <div className="quick-filters"><button onClick={()=>setQuery('')}>전체</button><button onClick={()=>setQuery('21세')}>21세</button><button onClick={()=>setQuery('후불')}>후불</button><button onClick={()=>setQuery('카드')}>카드</button><button>상세필터</button></div>
        <div className="list">{filtered.map(p=>{const o=p.offers[0];return <article key={p.id} onClick={()=>selectProduct(p)} className={`product-row ${p.id===selected.id?'selected':''}`}><div className="thumb">CAR</div><div className="grow"><div className="row-title"><strong>{p.name}</strong><span>{p.match}</span></div><p>{p.sub}</p><div className="price"><b>월 {money(o.rent)}</b><small>{o.term}개월</small></div></div></article>})}</div>
      </section>

      <section className="panel detail-panel">
        <div className="panel-head"><div><p className="eyebrow">DETAIL</p><h1>상품 상세</h1></div><button className="icon-btn">공유</button></div>
        <div className="tabs"><button className="active">요약</button><button>상세정보</button></div>
        <div className="hero-car"><span>차량 이미지</span><small>SSOT</small></div>
        <div className="vehicle-title"><div><h2>{selected.name}</h2><p>{selected.sub}</p></div><span className="status-dot">판매중</span></div>
        <dl className="summary-grid"><div><dt>공급사</dt><dd>{selected.supplier}</dd></div><div><dt>차종 매칭</dt><dd>{selected.match}</dd></div><div><dt>보증금</dt><dd>{money(selectedOffer.deposit)}</dd></div><div><dt>약정주행</dt><dd>연 {selectedOffer.mileage.toLocaleString()}km</dd></div></dl>
        <div className="offer-picker">{selected.offers.map(o=><button key={o.id} onClick={()=>setOfferId(o.id)} className={o.id===selectedOffer.id?'active':''}>{o.term}개월</button>)}</div>
        <div className="offer-block"><div><span>선택 Offer</span><b>{selectedOffer.term}개월</b></div><strong>월 {money(selectedOffer.rent)}</strong><p>보증금 {money(selectedOffer.deposit)} · 연 {selectedOffer.mileage.toLocaleString()}km</p></div>
        <div className="chips">{selectedOffer.policies.map(p=><span key={p}>{p}</span>)}</div>
        <button className="primary" onClick={openNew}>이 상품 접수하기</button>
      </section>

      <section className="panel work-panel">
        {work==='list'&&<><div className="panel-head"><div><p className="eyebrow">WORK</p><h1>접수 목록</h1></div><button className="new-app" onClick={openNew}>+ 신규접수</button></div><div className="work-tabs"><button className="active">전체 {apps.length}</button><button>진행중 {apps.filter(a=>!a.delivery&&!a.cancelled).length}</button><button>인도완료 {apps.filter(a=>a.delivery).length}</button><button>취소 {apps.filter(a=>a.cancelled).length}</button></div><div className="application-list">{apps.map(app=><article className="application-card" key={app.id} onDoubleClick={()=>openApp(app)}><div className="app-top"><div><b>{app.customer}</b><span>{app.no}</span></div><strong>{app.vehicle}</strong></div><div className="checks"><span className={app.contract?'done':''}>계약서</span><span className={app.docs?'done':''}>서류</span><span className={app.delivery?'done':''}>인도</span></div><p>{app.cancelled?'취소':app.delivery?'인도 완료':app.contract?'진행중 · 다음 확인 필요':'신규 접수 · 계약 확인 전'}</p></article>)}</div><div className="work-hint"><b>접수 상세</b><span>접수 건을 더블 클릭하면 진행상태를 확인합니다.</span></div></>}

        {work==='new'&&<><div className="panel-head"><div><p className="eyebrow">NEW APPLICATION</p><h1>신규 접수</h1></div><button className="icon-btn" onClick={()=>setWork('list')}>목록</button></div><div className="selected-offer-card"><span>접수 상품</span><h2>{selected.name}</h2><p>{selected.sub}</p><b>{selectedOffer.term}개월 · 월 {money(selectedOffer.rent)}</b><small>이 조건은 접수 저장 시 Snapshot으로 보존됩니다.</small></div><div className="form-stack"><label>고객명<input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="고객명"/></label><label>연락처<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="010-0000-0000"/></label></div><button className="primary" onClick={submitApplication}>접수 저장</button></>}

        {work==='detail'&&activeApp&&<><div className="panel-head"><div><p className="eyebrow">APPLICATION</p><h1>접수 상세</h1></div><button className="icon-btn" onClick={()=>setWork('list')}>목록</button></div><div className="application-detail-head"><span>{activeApp.no}</span><h2>{activeApp.customer} · {activeApp.vehicle}</h2><p>{activeApp.phone}</p></div><div className="snapshot-box"><span>접수 당시 조건</span><b>{activeApp.offer.term}개월 · 월 {money(activeApp.offer.rent)}</b><p>보증금 {money(activeApp.offer.deposit)} · 연 {activeApp.offer.mileage.toLocaleString()}km</p></div><div className="progress-actions"><button className={activeApp.contract?'done':''} onClick={()=>patchApp('contract')}>계약서 {activeApp.contract?'✓':'-'}</button><button className={activeApp.docs?'done':''} onClick={()=>patchApp('docs')}>필수서류 {activeApp.docs?'✓':'-'}</button><button className={activeApp.delivery?'done':''} onClick={()=>patchApp('delivery')}>인도완료 {activeApp.delivery?'✓':'-'}</button></div><div className={`application-status ${activeApp.cancelled?'cancelled':''}`}>{activeApp.cancelled?'취소':activeApp.delivery?'인도완료':activeApp.contract?'계약완료 · 진행중':'접수완료'}</div>{!activeApp.cancelled&&<button className="danger-link" onClick={cancelApp}>접수 취소</button>}</>}
      </section>
    </section>
  </main>
}
