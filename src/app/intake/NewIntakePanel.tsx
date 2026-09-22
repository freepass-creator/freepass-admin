import { productById, today } from '../../server/erp5';
import { writeEnabled } from '../../adapters/erp5/settlement-repository';
import type { SettlementRow } from '../../domain/settlement/types';
import { txt, won } from '../_fn/fmt';
import { vehicleName } from '../_fn/product';
import IntakeForm, { type IntakeDefaults } from './new/IntakeForm';
import { EmptyState, Notice, PanelHeader } from '../_design/Primitives';
import { previewFeeAction } from './actions';
import { LEDGER_PRODUCTS, ledgerKindOf } from '../../domain/settlement/product-kind';
import { buildIntakeOptions } from './intake-options';

/** 오른쪽 판 — 신규 접수. 상품에서 왔으면 차·요금이 미리 채워진다. */
export async function NewIntakePanel({ rows, productId, offerId, back }: {
  rows: SettlementRow[]; productId: string; offerId: string; back: string;
}) {
  const selectedProductPath = !!productId;
  const product = selectedProductPath ? await productById(productId) : null;
  /* ★차의 상품구분 → 원장 상품구분 · 렌트구분(기능 ledgerKindOf) — 원장 말이 수수료 갈래를 정한다 */
  const 짝 = product ? ledgerKindOf(product.productKind) : null;
  const 고를말 = product ? (짝 ? (짝.certain ? [] : 짝.choices) : [...LEDGER_PRODUCTS]) : [];
  const offer = product?.offers.find((o) => o.id === offerId);
  const options = buildIntakeOptions(rows);
  const defaults: IntakeDefaults = {
    receivedAt: today(),
    plate: product?.registration?.vehicleNumber ?? '',
    model: product ? [product.vehicle.modelId, product.vehicle.subModelId].filter(Boolean).join(' ') : '',
    supplier: product?.supplierName ?? '',
    supplierCode: product?.supplierId ?? '',
    term: offer ? String(offer.termMonths) : '',
    rent: offer ? String(offer.monthlyRent) : '',
    deposit: offer?.deposit !== undefined ? String(offer.deposit) : '',
    product: 짝?.product ?? '',
    rentKind: 짝?.rentKind ?? '',
    price: product?.consumerPrice !== undefined ? String(product.consumerPrice) : '',
    sourceProductId: product?.id ?? '',
    sourceProductVersion: product ? String(product.version) : '',
    sourceOfferId: offer?.id ?? '',
    sourceSnapshotId: product?.sourceSnapshotId ?? '',
  };
  /*
   * ★수수료 — 기간이 정해지면 «접수할 때» 이미 안다(대표 2026-09-18 「이미 기간에 따라서 수수료는 접수할 때도 알아야 하고」).
   *   기능 쪽 셈(feeOf · ERP5 수수료표) 그대로 — 저장할 때 원장에 서는 값과 같은 입력(공급사 · 상품구분 · 모델 · 기간 · 대여료 · 차량가)으로 센다.
   */
  const 수수료 = product && offer
    ? await previewFeeAction((() => {
      const f = new FormData();
      for (const [k, v] of Object.entries({ supplier: defaults.supplier, product: defaults.product ?? '', model: defaults.model, term: defaults.term, rent: defaults.rent, price: defaults.price ?? '' })) f.set(k, v);
      return f;
    })())
    : null;
  return (
    <>
      {/* 폰 — 접수 목록(탭 홈)으로 뒤로. §14 개정 「하단은 홈 + 그 판 걸음」 — 이 판은 접수 tab 의 depth1 */}
      <PanelHeader title="신규 접수" backHref={back} backLabel="접수 목록으로" />
      {product ? (
        /* ★차 골라 접수 — 차 · 기간 · 값 · 수수료는 이미 정해졌다(읽기). 바꾸려면 가운데 상세에서 기간을 다시 골라 「이 상품 접수하기」 */
        <div className="dz-picked">
          <span className="dz-picked-label">접수 상품</span>
          <b>{vehicleName(product)}</b>
          <p>{txt(product.registration?.vehicleNumber)} · {product.supplierName ?? product.supplierId}{짝?.certain ? ` · ${짝.product}` : product.productKind ? ` · ${product.productKind}` : ''}</p>
          {offer
            ? <dl className="dz-picked-grid">
                <div><dt>기간</dt><dd>{offer.termMonths}개월</dd></div>
                <div><dt>월 대여료</dt><dd>{won(offer.monthlyRent)}원</dd></div>
                <div><dt>보증금</dt><dd>{offer.deposit === undefined ? '미확인' : `${won(offer.deposit)}원`}</dd></div>
                <div><dt>수수료</dt><dd>{
                  고를말.length ? <span className="dz-muted">상품구분을 고르면 섭니다</span>
                  : !수수료 ? '—'
                    : 수수료.status === 'AUTO' ? <>청구 <b>{won(수수료.claim)}</b> · 지급 <b>{won(수수료.pay)}</b></>
                      : <span className="dz-warn-txt">직접 넣어야 함</span>
                }</dd></div>
              </dl>
            : <Notice tone="warn">요금을 못 찾았습니다 — 가운데 상세에서 기간을 다시 골라 주세요.</Notice>}
          {!고를말.length && 수수료?.status === 'AUTO' && <small className="dz-picked-note">ERP5 수수료표 · {수수료.basis} · 다르게 하려면 「더 넣기」에서 고침(사유)</small>}
          {!고를말.length && 수수료 && 수수료.status !== 'AUTO' && <small className="dz-picked-note dz-warn-txt">{수수료.why}</small>}
        </div>
      ) : selectedProductPath
        ? <Notice tone="warn">선택한 상품을 더 이상 찾을 수 없습니다 — 상품 목록에서 다시 골라 주세요.</Notice>
        : <EmptyState>차 없이 직접 넣습니다. 차에서 고르려면 가운데 상세에서 기간을 고르고 「이 상품 접수하기」.</EmptyState>}
      {!writeEnabled() && <Notice tone="warn">ERP5 쓰기가 꺼져 있어 「접수 저장」은 저장되지 않습니다.</Notice>}
      <EmptyState>같은 차량번호 + 접수일이 원장에 이미 있으면 새로 만들지 않고 그 줄을 엽니다.</EmptyState>
      {(!selectedProductPath || (product && offer)) && (
        <div className="dz-form"><IntakeForm defaults={defaults} options={options} cancelHref={back} picked={!!(product && offer)} fee={수수료}
          productChoices={고를말} ledgerProducts={LEDGER_PRODUCTS} /></div>
      )}
    </>
  );
}
