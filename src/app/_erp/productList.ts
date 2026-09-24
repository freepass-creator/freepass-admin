/**
 * 상품목록 — 계약접수(Workspace.tsx)·상품찾기(ProductsScreen.tsx) 가 같이 쓰는 필터·정렬 한 곳
 * (대표 2026-09-24 「모든 페이지는 다 패널화 돼 있다」와 같은 결 — 목록 계산을 화면마다 새로 짜지 않는다).
 * 검색(pq) · 공급사/상품구분 필터(psup/pkind, FilterSheet) · 즉시출고 퀵 필터(pst) · 고른 상품(id/offer).
 */
import { lead, STATUS_ORDER, 많은순 } from '../products/workspace-config';
import { standingFixed, tallyMatch } from '../_design/facet-standing';
import type { FacetAxis } from '../_design/FilterSheet';
import { 고른값 } from '../_design/pick';
import type { CanonicalProduct } from '../../domain/product/types';
import { sp } from '../_fn/fmt';
import { carName } from './ProductDetail';

type Q = Record<string, string | string[] | undefined>;

export function buildProductList(products: CanonicalProduct[], q: Q) {
  const text = sp(q.pq).trim().toLowerCase();
  const pst = sp(q.pst);
  const 상품축: [string, string, (p: CanonicalProduct) => string][] = [
    ['psup', '공급사', (p) => p.supplierName ?? p.supplierId ?? ''],
    ['pkind', '상품구분', (p) => p.productKind ?? ''],
  ];
  const pSel = Object.fromEntries(상품축.map(([a]) => [a, 고른값(sp(q[a]))])) as Record<string, string[]>;
  const p통과 = (p: CanonicalProduct, skip?: string) => 상품축.every(([a, , of]) => a === skip || !pSel[a].length || pSel[a].includes(of(p)));
  const textFiltered = products
    .filter((p) => !text || [carName(p), p.registration?.vehicleNumber, p.supplierName ?? p.supplierId].filter(Boolean).join(' ').toLowerCase().includes(text))
    .filter((p) => lead(p.offers))
    .map((p) => ({ p, offer: lead(p.offers)! }));
  const all = textFiltered
    .filter((h) => p통과(h.p))
    .sort((a, b) => (STATUS_ORDER[a.p.status ?? ''] ?? 9) - (STATUS_ORDER[b.p.status ?? ''] ?? 9) || a.offer.monthlyRent - b.offer.monthlyRent);
  const readyCount = all.filter((h) => h.p.status === '즉시출고').length;
  const hits = pst ? all.filter((h) => h.p.status === pst) : all;
  const 상품전체 = products.filter((p) => lead(p.offers));
  const facets: FacetAxis[] = 상품축.map(([a, label, of]) => {
    const keys = 많은순(상품전체.map(of));
    const base = tallyMatch(상품전체, keys, (p, k) => of(p) === k);
    const live = tallyMatch(textFiltered.map((h) => h.p).filter((p) => p통과(p, a)), keys, (p, k) => of(p) === k);
    return { key: a, label, options: standingFixed(keys, base, live).map((o) => ({ key: o.key, label: o.key, count: o.count })) };
  });
  const selId = sp(q.id);
  const sel = hits.find((h) => h.p.id === selId) ?? hits[0];
  const selOffers = sel ? sel.p.offers.slice().sort((a, b) => a.termMonths - b.termMonths) : [];
  const selOffer = sel ? (selOffers.find((o) => o.id === sp(q.offer)) ?? sel.offer) : undefined;

  return { text, pst, all, hits, readyCount, facets, sel, selOffers, selOffer };
}
