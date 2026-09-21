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

export const today = () => {
  const d = new Date(Date.now() + 9 * 3600_000);   // ★접수일은 한국 날짜다
  return d.toISOString().slice(0, 10);
};
