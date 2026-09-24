/**
 * 상품상세 — §5-4 상세내용 판. 계약접수(Workspace.tsx)·상품찾기(ProductsScreen.tsx) 가 같은 상품을
 *   가리킬 때 똑같은 판을 연다(대표 2026-09-24 「모든 페이지는 다 패널화 돼 있다」와 같은 결 — 화면마다
 *   새로 그리지 않는다). 원래 Workspace.tsx 안에 있던 것을 그대로 뽑았다 — 모양 · 계산 전부 그대로.
 */
import Link from 'next/link';
import type { CanonicalProduct, Offer } from '../../domain/product/types';
import { txt } from '../_fn/fmt';
import { Badge, hrefWith, PanelBody, PanelFoot, PanelHead, Tile, TileGroup, won0, type Tone } from './parts';

type Q = Record<string, string | string[] | undefined>;
export const STATUS_TONE: Record<string, Tone> = { 즉시출고: 'ok', 출고가능: 'info', 출고협의: 'warn', 출고불가: 'err' };
export const carName = (p: CanonicalProduct) => p.vehicle.subModelId || p.vehicle.modelId;

/** 차 아이콘 — ai-core 레퍼런스 side-by-side.html 의 svg path 그대로(새로 그리지 않는다). */
export function CarIcon() {
  return (
    <svg viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M8 42h104M14 42l6-14c2-5 6-8 12-9l22-3c8-1 16 1 22 6l12 10 14 3c4 1 6 4 6 7M30 42a8 8 0 1 0 16 0M78 42a8 8 0 1 0 16 0M40 20l4 14h24l-6-15" />
    </svg>
  );
}

export function ProductDetail({ sel, selOffers, selOffer, base, q }: {
  sel: { p: CanonicalProduct; offer: Offer } | undefined;
  selOffers: Offer[];
  selOffer: Offer | undefined;
  base: string;
  q: Q;
}) {
  return (
    <>
      <PanelHead kind="상세내용" title={sel ? `${txt(sel.p.registration?.vehicleNumber)} ${carName(sel.p)}` : '상품상세'} count="고른 상품" />
      <PanelBody>
        {sel ? (
          <div className="erp-detail-body">
            <div className="erp-hero-tile erp-tile">
              <div className="photo"><CarIcon /></div>
              <div className="erp-hero-info">
                <h2 className="name">{carName(sel.p)} {sel.p.status ? <Badge tone={STATUS_TONE[sel.p.status] ?? 'neutral'}>{sel.p.status}</Badge> : null}</h2>
                <p className="sub"><b>{txt(sel.p.registration?.vehicleNumber)}</b>{txt(sel.p.vehicle.manufacturerId)} · {txt(sel.p.supplierName ?? sel.p.supplierId)}</p>
                <p className="erp-hero-line">{sel.p.specs.modelYear ?? '—'}식 · {typeof sel.p.specs.mileageKm === 'number' ? `${sel.p.specs.mileageKm.toLocaleString('ko-KR')}km` : '—'} · {txt(sel.p.extColor)} · {txt(sel.p.productKind)}</p>
              </div>
            </div>

            <div>
              <p className="erp-subtitle erp-subtitle--lead">대여료</p>
              <TileGroup>
                {selOffers.map((o) => (
                  <Tile key={o.id} href={hrefWith(base, q, { offer: o.id })} pressed={selOffer?.id === o.id}
                    lede={`${o.termMonths}개월`} figure={`${won0(o.monthlyRent)}원`}
                    note={o.deposit ? `보증금 ${won0(o.deposit)}원` : '보증금 없음'} />
                ))}
              </TileGroup>
            </div>

            {(sel.p.perks ?? []).length ? (
              <div>
                <p className="erp-subtitle">담당자 참고</p>
                <div className="erp-tile-group">
                  <div className="erp-info-card erp-tile">
                    <h3 className="erp-tile-title">우대조건 · 정책</h3>
                    <dl>
                      <div><dt>우대조건</dt><dd><span className="erp-tags">{(sel.p.perks ?? []).map((k) => <span key={k} className="erp-tag erp-tag--primary">{k}</span>)}</span></dd></div>
                      <div><dt>공급사</dt><dd>{txt(sel.p.supplierName ?? sel.p.supplierId)}</dd></div>
                    </dl>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : <p className="erp-muted">왼쪽에서 상품을 고르세요.</p>}
      </PanelBody>
      <PanelFoot>
        {sel && selOffer
          ? <Link className="erp-btn erp-btn--primary" href={`/intake?w=new&product=${encodeURIComponent(sel.p.id)}&offer=${encodeURIComponent(selOffer.id)}`}>접수하기</Link>
          : <span className="erp-btn erp-btn--primary" aria-disabled="true">접수하기</span>}
      </PanelFoot>
    </>
  );
}
