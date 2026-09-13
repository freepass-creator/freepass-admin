'use client';

import { useMemo, useState } from 'react';
import type { SalesProductProjection } from '@/domain/access/sales-product';
import { money, TERM_OPTIONS } from '@/domain/product/display';

function productMatchesQuery(product: SalesProductProjection, query: string) {
  const text = `${product.displayName} ${product.sub} ${product.category} ${product.vehicleNumber ?? ''}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

export function SalesCatalog({ products }: { products: SalesProductProjection[] }) {
  const [query, setQuery] = useState('');
  const [termMonths, setTermMonths] = useState(36);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [selectedOfferId, setSelectedOfferId] = useState(
    products[0]?.offers.find((offer) => offer.termMonths === 36)?.id ?? products[0]?.offers[0]?.id ?? '',
  );

  const matches = useMemo(() => products.flatMap((product) => {
    if (!productMatchesQuery(product, query)) return [];
    const offer = product.offers.find((candidate) => candidate.termMonths === termMonths);
    return offer ? [{ product, offer }] : [];
  }), [products, query, termMonths]);

  const selectedMatch = matches.find(({ product }) => product.id === selectedProductId) ?? matches[0];
  const selectedProduct = selectedMatch?.product;
  const selectedOffer = selectedProduct?.offers.find((offer) => offer.id === selectedOfferId)
    ?? selectedMatch?.offer;

  function chooseProduct(product: SalesProductProjection, offerId: string) {
    setSelectedProductId(product.id);
    setSelectedOfferId(offerId);
  }

  function changeTerm(term: number) {
    setTermMonths(term);
    const queryMatches = products.filter((product) => productMatchesQuery(product, query));
    const current = queryMatches.find((product) => product.id === selectedProductId);
    const currentOffer = current?.offers.find((offer) => offer.termMonths === term);
    if (currentOffer && current) return chooseProduct(current, currentOffer.id);
    const first = queryMatches.find((product) => product.offers.some((offer) => offer.termMonths === term));
    const offer = first?.offers.find((candidate) => candidate.termMonths === term);
    if (first && offer) chooseProduct(first, offer.id);
  }

  return <main className="erp-shell sales-shell">
    <aside className="global-nav">
      <div className="brand"><strong>FP</strong><span>freepasserp.com</span></div>
      <nav><button className="active">상품</button></nav>
      <div className="nav-user"><b>영업자</b><span>SALES</span><small>상품 조회 전용 · 운영 연결 전</small></div>
    </aside>

    <section className="workspace sales-workspace">
      <section className="panel">
        <div className="panel-head"><h1>상품 목록</h1><span className="count">{matches.length}건</span></div>
        <label className="searchbox"><span>검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="차량명, 차량번호, 상품구분" /></label>
        <label className="compact-filter">계약기간<select value={termMonths} onChange={(event) => changeTerm(Number(event.target.value))}>{TERM_OPTIONS.map((term) => <option key={term} value={term}>{term}개월</option>)}</select></label>
        <div className="list">{matches.map(({ product, offer }) => <button className={`data-row product-row ${product.id === selectedProduct?.id ? 'selected' : ''}`} key={product.id} onClick={() => chooseProduct(product, offer.id)}>
          <span className="status-line"><i />{product.status} · {product.category}</span>
          <strong>{product.vehicleNumber ?? '차량번호 미배정'} · {product.displayName}</strong>
          <span>{product.sub}</span><b className="numeric">{offer.termMonths}개월 · 월 {money(offer.monthlyRent)}</b>
        </button>)}</div>
      </section>

      <section className="panel">
        {!selectedProduct || !selectedOffer ? <div className="empty">조회할 상품이 없습니다.</div> : <>
          <div className="panel-head"><h1>상품 상세</h1><span>조회 전용</span></div>
          <div className="vehicle-heading"><span>{selectedProduct.category} · {selectedProduct.status}</span><h2>{selectedProduct.displayName}</h2><p>{selectedProduct.vehicleNumber ?? '차량번호 미배정'} · {selectedProduct.sub}</p></div>
          <h3>기간별 대여료 및 보증금</h3>
          <div className="offer-list">{selectedProduct.offers.map((offer) => <button key={offer.id} className={offer.id === selectedOffer.id ? 'selected' : ''} onClick={() => setSelectedOfferId(offer.id)}>
            <b>{offer.termMonths}개월</b><span className="numeric">월 {money(offer.monthlyRent)}</span><span className="numeric">보증금 {offer.deposit === undefined ? '미확인' : money(offer.deposit)}</span><span className="numeric">연 {offer.annualMileageKm?.toLocaleString('ko-KR') ?? '미확인'}km</span>
          </button>)}</div>
          <div className="detail-lines"><p><b>상품 구분</b><span>{selectedProduct.category}</span></p><p><b>차량 정보</b><span>{selectedProduct.specs.fuel ?? '미확인'} · {selectedProduct.specs.seats ?? '미확인'}인승</span></p><p><b>선택 조건</b><span>{selectedOffer.termMonths}개월 · 월 {money(selectedOffer.monthlyRent)}</span></p></div>
        </>}
      </section>
    </section>
  </main>;
}
