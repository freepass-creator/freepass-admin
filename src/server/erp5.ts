/**
 * **서버 조립 자리** — 화면(src/app)은 여기서만 문을 얻는다.
 *
 * ★화면은 ERP5 를 모른다. 문 뒤를 갈아 끼우면 여기 한 곳만 고친다
 *   (대표 2026-09-18 「디자인과 기능은 확실히 분리」).
 * ★상품은 1,615건을 매번 읽으면 느리다 — 60초만 들고 있는다. 정산은 매번 읽는다(방금 쓴 것이 보여야 한다).
 */
import { Erp5ProductRepository } from '../adapters/erp5/product-repository';
import { Erp5SettlementRepository } from '../adapters/erp5/settlement-repository';
import { Erp5ContractRepository } from '../adapters/erp5/contract-repository';
import type { CanonicalProduct } from '../domain/product/types';

const g = globalThis as unknown as {
  __fpaProducts?: { at: number; rows: CanonicalProduct[]; report: ReturnType<Erp5ProductRepository['report']> };
};

export const products = new Erp5ProductRepository();
export const settlements = new Erp5SettlementRepository();
export const contracts = new Erp5ContractRepository();

const TTL = 60_000;

export async function productList() {
  const hit = g.__fpaProducts;
  if (hit && Date.now() - hit.at < TTL) return hit;
  const rows = await products.list();
  g.__fpaProducts = { at: Date.now(), rows, report: products.report() };
  return g.__fpaProducts;
}

export async function productById(id: string) {
  const { rows } = await productList();
  return rows.find((p) => p.id === id) ?? (await products.get(id));
}

/**
 * 저장/상태변경 경계에서 쓰는 상품 단건 조회.
 *
 * 목록용 60초 캐시는 화면 성능을 위한 것이므로 mutation 검증에는 사용하지 않는다.
 * 접수 화면을 연 뒤 상품/Offer가 바뀐 경우, 저장 직전에 ERP5 정본을 다시 읽어
 * productVersion/sourceSnapshotId/Offer drift를 fail-closed 한다.
 */
export async function productByIdFresh(id: string) {
  return products.get(id);
}

export const today = () => {
  const d = new Date(Date.now() + 9 * 3600_000);   // ★접수일은 한국 날짜다
  return d.toISOString().slice(0, 10);
};
