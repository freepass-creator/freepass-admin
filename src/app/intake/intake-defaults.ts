import { today } from '../../server/erp5';
import type { CanonicalProduct } from '../../domain/product/types';
import { LEDGER_PRODUCTS, ledgerKindOf } from '../../domain/settlement/product-kind';
import type { IntakeDefaults } from './new/IntakeForm';

/**
 * 차 골라 접수 — 상품 · 요금에서 접수 기본값을 한 곳에서 만든다.
 *   /intake 신규 접수(NewIntakePanel)와 /products 판의 접수 칸이 같은 값으로 createIntakeAction 에 넘긴다.
 *   choices: 원장 상품구분을 사람이 골라야 할 때의 말들(비었으면 짝이 하나로 떨어짐 — 숨은 칸).
 */
export function intakeDefaults(product: CanonicalProduct | null, offerId: string,
  prefill?: { customer?: string; channel?: string; agent?: string }) {
  const 짝 = product ? ledgerKindOf(product.productKind) : null;
  const choices = product ? (짝 ? (짝.certain ? [] : 짝.choices) : [...LEDGER_PRODUCTS]) : [];
  const offer = product?.offers.find((o) => o.id === offerId);
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
    customer: prefill?.customer || undefined,
    channel: prefill?.channel || undefined,
    agent: prefill?.agent || undefined,
  };
  return { defaults, choices, offer, 짝 };
}
