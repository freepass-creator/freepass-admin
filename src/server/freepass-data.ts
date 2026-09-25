/**
 * FreePass Data — FreePass Admin의 유일한 데이터 출입구.
 *
 * Firebase/Firestore(project: freepasserp5)는 FreePass Data의 기술 저장소다.
 * App/UI/Server feature code는 Firebase나 adapters/erp5를 직접 알면 안 된다.
 *
 * 읽기:
 *   Admin -> FreePass Data -> repository -> Firestore
 * 쓰기:
 *   Admin -> FreePass Data -> repository transaction -> Firestore
 *
 * RTDB는 사용하지 않는다.
 */
import { Erp5ProductRepository } from '../adapters/erp5/product-repository';
import { Erp5SettlementRepository, WriteDisabledError, writeEnabled, type ClaimView } from '../adapters/erp5/settlement-repository';
import { Erp5ContractRepository } from '../adapters/erp5/contract-repository';
import { ERP5_PROJECT_ID, erp5Ready } from '../adapters/erp5/firestore';
import { loadFeeRuleSet } from '../adapters/erp5/fee-rules';
import type { CanonicalProduct } from '../domain/product/types';

export const FREEPASS_DATA_PROJECT_ID = ERP5_PROJECT_ID;

const g = globalThis as unknown as {
  __freepassDataProducts?: {
    at: number;
    rows: CanonicalProduct[];
    report: ReturnType<Erp5ProductRepository['report']>;
  };
};

/** FreePass Data repositories — raw Firestore access는 adapter 내부에만 있다. */
export const products = new Erp5ProductRepository();
export const settlements = new Erp5SettlementRepository();
export const contracts = new Erp5ContractRepository();

const PRODUCT_CACHE_TTL_MS = 60_000;

/** 상품 목록 읽기 — FreePass Data canonical products. */
export async function productList() {
  const hit = g.__freepassDataProducts;
  if (hit && Date.now() - hit.at < PRODUCT_CACHE_TTL_MS) return hit;
  const rows = await products.list();
  g.__freepassDataProducts = { at: Date.now(), rows, report: products.report() };
  return g.__freepassDataProducts;
}

export async function productById(id: string) {
  const { rows } = await productList();
  return rows.find((p) => p.id === id) ?? (await products.get(id));
}

/**
 * 쓰기 직전 authoritative fresh read.
 * 화면 목록의 60초 캐시를 mutation 검증에 사용하지 않는다.
 */
export async function productByIdFresh(id: string) {
  return products.get(id);
}

/** 수수료 규칙도 FreePass Data 경계를 통해 소비한다. */
export const feeRuleSet = () => loadFeeRuleSet();

/** 데이터 연결/쓰기 상태도 이 게이트를 통해서만 노출한다. */
export const freePassDataReady = () => erp5Ready();
export const freePassDataWriteEnabled = () => writeEnabled();

/** App에서 adapter 구현 클래스를 직접 import하지 않게 경계 타입/오류만 재노출한다. */
export { WriteDisabledError };
export type { ClaimView };

export const today = () => {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
};
