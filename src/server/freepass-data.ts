/**
 * FreePass Data: single Admin read/write gateway.
 *
 * Authority = FreePass Data.
 * Current migration stage = OBSERVE, so the returned product rows still come through
 * a read-only freepasserp5 legacy bridge until FreePass Data exposes an approved
 * Admin-specific consumer contract and ACTIVE Release.
 *
 * Admin Services own workflow semantics; this module owns their persistence entrypoint.
 * No separate Admin database or ledger authority is created.
 */
import { AdminCatalogSwitchboard } from '../adapters/freepass-data/admin-catalog-reader';
import { FreePassDataAdminCatalogClient } from '../adapters/freepass-data/admin-catalog-client';
import { Erp5ProductRepository } from '../adapters/erp5/product-repository';
import { Erp5SettlementRepository } from '../adapters/erp5/settlement-repository';
import { Erp5ContractRepository } from '../adapters/erp5/contract-repository';
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
  const cacheable = mode === 'LEGACY_DIRECT' || mode === 'OBSERVE';
  const hit = g.__fpaCatalog;
  if (cacheable && hit && hit.mode === mode && Date.now() - hit.at < TTL) return hit;
  const result = await adminCatalog.list();
  const fresh = { at: Date.now(), mode, rows: result.rows, receipt: result.receipt };
  if (cacheable) g.__fpaCatalog = fresh;
  else delete g.__fpaCatalog;
  return fresh;
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

/** Shared persistence ports; business commands and transitions remain in Admin Services. */
export const settlements = new Erp5SettlementRepository();
export const contracts = new Erp5ContractRepository();
export { esignAssets, esignRepository } from '../adapters/erp5/esign-repository';
export { writeEnabled, writeGate, WriteDisabledError, type ClaimView } from '../adapters/erp5/settlement-repository';
export { loadFeeRuleSet as feeRuleSet } from '../adapters/erp5/fee-rules';
export { ERP5_PROJECT_ID, erp5Ready, demoMode } from '../adapters/erp5/firestore';

export const today = () => {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
};
