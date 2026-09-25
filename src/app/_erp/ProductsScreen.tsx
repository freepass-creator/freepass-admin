/**
 * PC 상품찾기 — 상품찾기가 메인인 화면이라 판 둘뿐: 목록 판(넓게, 1×2) | 상품상세 판(1) (§5-4,
 *   대표 2026-09-24 「상품 찾기 페이지가 메인이야 … 패널 두 개를 합쳐서 상품 목록을 두 줄로 깔면 돼.
 *   넓게 두 줄로 … 상품 찾기는 목록 패널이 1 곱하기 2짜리가 들어가. 그리고 상세 패널은 계약 접수
 *   페이지에도 있는 그 패널이 동일하게 우측에」). 예전 §4 두 칸 카드 화면(단독 페이지, 「저 화면은 안
 *   쓰는 거야」)을 걷어내고 계약접수(Workspace.tsx)와 같은 목록 계산(productList.ts)·같은 상세
 *   부품(ProductDetail)을 그대로 쓴다.
 */
import { productList } from '../../server/erp5';
import type { CanonicalProduct } from '../../domain/product/types';
import { sp, txt } from '../_fn/fmt';
import { FilterSheet } from '../_design/FilterSheet';
import { buildProductList } from './productList';
import { ProductDetail, ProductThumb, STATUS_TONE, carName } from './ProductDetail';
import { Badge, hrefWith, Panel, PanelBody, PanelHead, QuickFilter, RowCard, RowCards, Screen, SearchBar, manWon } from './parts';

type Q = Record<string, string | string[] | undefined>;

export async function ProductsScreen({ q, base = '/products' }: { q: Q; base?: string }) {
  let products: CanonicalProduct[];
  try { products = (await productList()).rows; }
  catch (e) {
    return (
      <Screen name="products-workspace">
        <Panel compact><PanelHead kind="목록" title="상품찾기" count="오류" />
          <PanelBody><p className="erp-field-error">ERP5 를 못 읽었습니다 — {(e as Error).message}</p></PanelBody></Panel>
      </Screen>
    );
  }

  const { all, hits, readyCount, facets, sel, selOffers, selOffer } = buildProductList(products, q);
  const pst = sp(q.pst);

  return (
    <Screen name="products-workspace">
    <div className="erp-workspace">
      <Panel compact wide>
        <PanelHead kind="목록" title="상품찾기" count={`전체 ${hits.length}건`} />
        <SearchBar base={base} q={q} name="pq" placeholder="차량번호 · 차명 · 공급사" keep={['id', 'offer', 'pst']}
          filter={<FilterSheet axes={facets} count={hits.length} unit="대" label="필터" />} />
        <QuickFilter label="퀵 필터" items={[
          { key: 'all', label: `전체 ${all.length}`, href: hrefWith(base, q, { pst: null, id: null }), on: !pst },
          { key: 'ready', label: `즉시출고 ${readyCount}`, href: hrefWith(base, q, { pst: '즉시출고', id: null }), on: pst === '즉시출고' },
        ]} />
        <PanelBody>
          <RowCards label="상품 목록">
            {hits.map(({ p, offer }) => (
              <RowCard key={p.id} href={hrefWith(base, q, { id: p.id, offer: offer.id })} current={sel?.p.id === p.id}
                tone={STATUS_TONE[p.status ?? ''] ?? 'neutral'} thumb={<ProductThumb p={p} />}
                title={carName(p)} badge={p.status ? <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Badge> : null}
                subId={txt(p.registration?.vehicleNumber)} sub={txt(p.productKind)}
                meta={`${offer.termMonths}개월 · 보증 ${offer.deposit ? `${manWon(offer.deposit)} 원` : '없음'}`}
                facts={[['상품구분', txt(p.productKind)], ['기간', `${offer.termMonths}개월`]]}
                amount={`월 ${manWon(offer.monthlyRent)} 원`} unit="" />
            ))}
          </RowCards>
        </PanelBody>
      </Panel>

      <Panel>
        <ProductDetail sel={sel} selOffers={selOffers} selOffer={selOffer} base={base} q={q} />
      </Panel>
    </div>
    </Screen>
  );
}
