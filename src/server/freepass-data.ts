/**
 * FreePass Admin Catalog consumer boundary.
 *
 * Authority = FreePass Data.
 * Current migration stage = OBSERVE, so the returned product rows still come through
 * a read-only freepasserp5 legacy bridge until FreePass Data exposes an approved
 * Admin-specific consumer contract and ACTIVE Release.
 *
 * Do not move intake/settlement/e-sign workflow ownership into this module.
 */
import { AdminCatalogSwitchboard } from '../adapters/freepass-data/admin-catalog-reader';
import { FreePassDataAdminCatalogClient } from '../adapters/freepass-data/admin-catalog-client';
import { Erp5ProductRepository } from '../adapters/erp5/product-repository';
import type { CanonicalProduct } from '../domain/product/types';
import type { AdminCatalogReceipt, AdminCatalogReadMode } from '../ports/admin-catalog-reader';

const g = globalThis as unknown as {
  __fpaCatalog?: {
    at: number;
    mode: AdminCatalogReadMode;
    rows: CanonicalProduct[];
    receipt: AdminCatalogReceipt;
  };
};

export const legacyProducts = new Erp5ProductRepository();
export const freepassDataProducts = new FreePassDataAdminCatalogClient();
export const adminCatalog = new AdminCatalogSwitchboard(legacyProducts, freepassDataProducts);

const TTL = 60_000;

export async function productList() {
  const mode = adminCatalog.mode();
  const hit = g.__fpaCatalog;
  if (hit && hit.mode === mode && Date.now() - hit.at < TTL) return hit;
  const result = await adminCatalog.list();
  g.__fpaCatalog = { at: Date.now(), mode, rows: result.rows, receipt: result.receipt };
  return g.__fpaCatalog;
}

export async function productById(id: string) {
  const { rows } = await productList();
  return rows.find((p) => p.id === id) ?? (await adminCatalog.get(id));
}

/**
 * Mutation guard path: bypass the 60-second UI cache.
 * In OBSERVE this is a fresh legacy-bridge read; after cutover it must be supplied
 * by the FreePass Data Admin contract without changing the intake use case.
 */
export async function productByIdFresh(id: string) {
  return adminCatalog.get(id);
}

/** Runtime/status probe must bypass the UI cache. */
export async function adminCatalogListFresh() {
  return adminCatalog.list();
}

export function adminCatalogStatus() {
  return adminCatalog.receipt();
}
