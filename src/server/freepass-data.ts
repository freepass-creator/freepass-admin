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
import { AdminCatalogSwitchboard, adminCatalogReadMode, assessAdminCatalogParity } from '../adapters/freepass-data/admin-catalog-reader';
import { FreePassDataAdminCatalogClient } from '../adapters/freepass-data/admin-catalog-client';
import { FreePassDataAdminCompatProductRepository, adminCompatibilityTransportConfigured } from '../adapters/freepass-data/admin-compat-product-repository';
import { Erp5ProductRepository } from '../adapters/erp5/product-repository';
import { demoMode } from '../adapters/erp5/firestore';
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
  __fpaCatalogParity?: {
    at: number;
    promise: Promise<AdminCatalogParityAuditResult>;
  };
};

export type AdminCatalogParityAuditResult = {
  readiness: 'READY' | 'HOLD' | 'NOT_CONFIGURED';
  comparisonStatus: 'MATCH' | 'MISMATCH' | null;
  checkedAt: string;
  legacyRows: number | null;
  freepassRows: number | null;
  missingInFreePass: number | null;
  extraInFreePass: number | null;
  differentProducts: number | null;
  holdReasons: string[];
  errorCode?: 'FREEPASS_DATA_PARITY_AUDIT_FAILED' | 'FREEPASS_DATA_PARITY_AUDIT_TIMEOUT';
  release: null | {
    releaseId: string;
    manifestId: string;
    revision: number;
    inputDigest: string;
    dataDigest: string;
    policyParity: 'COMPLETE' | 'INCOMPLETE';
    commercialCoverage: 'COMPLETE' | 'INCOMPLETE';
  };
};

export const directLegacyProducts = new Erp5ProductRepository();
export const compatibilityProducts = new FreePassDataAdminCompatProductRepository();
export const freepassDataProducts = new FreePassDataAdminCatalogClient();

/**
 * Transport selector for the legacy-shape comparison source.
 * Only explicit LEGACY_DIRECT may touch ERP5 from Admin. Every migration stage routes the
 * same compatibility values through FreePass Data first, so Admin can shed Firebase credentials
 * before semantic cutover to the approved admin-catalog projection.
 */
const useDirectCatalogTransport = () =>
  demoMode()
  || adminCatalogReadMode() === 'LEGACY_DIRECT'
  || !adminCompatibilityTransportConfigured();

export const legacyProducts = {
  list: () => useDirectCatalogTransport()
    ? directLegacyProducts.list()
    : compatibilityProducts.list(),
  get: (id: string) => useDirectCatalogTransport()
    ? directLegacyProducts.get(id)
    : compatibilityProducts.get(id),
  report: () => useDirectCatalogTransport()
    ? directLegacyProducts.report()
    : compatibilityProducts.report(),
};

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

/**
 * Read-only operator evidence. This never changes the serving mode or the rows returned to users.
 * It compares the compatibility result with the ACTIVE Admin Catalog contract using the same
 * intake-critical comparator as SHADOW_READ.
 */
type AdminCatalogParityAuditDependencies = {
  configured: boolean;
  readLegacy: () => Promise<CanonicalProduct[]>;
  readFreepass: () => ReturnType<FreePassDataAdminCatalogClient['list']>;
  now?: () => number;
  timeoutMs?: number;
};

export async function runAdminCatalogParityAudit({
  configured,
  readLegacy,
  readFreepass,
  now = Date.now,
  timeoutMs = 8_000,
}: AdminCatalogParityAuditDependencies): Promise<AdminCatalogParityAuditResult> {
  const checkedAt = new Date(now()).toISOString();
  if (!configured) {
    return {
      readiness: 'NOT_CONFIGURED', comparisonStatus: null, checkedAt,
      legacyRows: null, freepassRows: null, missingInFreePass: null,
      extraInFreePass: null, differentProducts: null,
      holdReasons: ['FREEPASS_DATA_PARITY_AUDIT_NOT_CONFIGURED'], release: null,
    };
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const reads = Promise.all([readLegacy(), readFreepass()]);
    const timed = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('FREEPASS_DATA_PARITY_AUDIT_TIMEOUT')), timeoutMs);
    });
    const [legacyRows, freepass] = await Promise.race([reads, timed]);
    const assessment = assessAdminCatalogParity(legacyRows, freepass.rows, freepass.meta);
    return {
      readiness: assessment.holdReasons.length === 0 ? 'READY' : 'HOLD',
      comparisonStatus: assessment.status,
      checkedAt,
      legacyRows: legacyRows.length,
      freepassRows: freepass.rows.length,
      missingInFreePass: assessment.missingInFreePass,
      extraInFreePass: assessment.extraInFreePass,
      differentProducts: assessment.differentProducts,
      holdReasons: assessment.holdReasons,
      release: {
        releaseId: freepass.meta.releaseId,
        manifestId: freepass.meta.manifestId,
        revision: freepass.meta.revision,
        inputDigest: freepass.meta.inputDigest,
        dataDigest: freepass.meta.dataDigest,
        policyParity: freepass.meta.policyParity,
        commercialCoverage: freepass.meta.commercialCoverage ?? 'INCOMPLETE',
      },
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.message === 'FREEPASS_DATA_PARITY_AUDIT_TIMEOUT';
    return {
      readiness: 'HOLD',
      comparisonStatus: null,
      checkedAt,
      legacyRows: null,
      freepassRows: null,
      missingInFreePass: null,
      extraInFreePass: null,
      differentProducts: null,
      holdReasons: [timedOut ? 'FREEPASS_DATA_PARITY_AUDIT_TIMEOUT' : 'FREEPASS_DATA_PARITY_AUDIT_FAILED'],
      errorCode: timedOut ? 'FREEPASS_DATA_PARITY_AUDIT_TIMEOUT' : 'FREEPASS_DATA_PARITY_AUDIT_FAILED',
      release: null,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const PARITY_AUDIT_TTL = 60_000;

export function adminCatalogParityAudit(): Promise<AdminCatalogParityAuditResult> {
  const hit = g.__fpaCatalogParity;
  if (hit && Date.now() - hit.at < PARITY_AUDIT_TTL) return hit.promise;
  const promise = runAdminCatalogParityAudit({
    configured: adminCompatibilityTransportConfigured() && !demoMode(),
    readLegacy: () => legacyProducts.list(),
    readFreepass: () => freepassDataProducts.list(),
  });
  g.__fpaCatalogParity = { at: Date.now(), promise };
  return promise;
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
import { loadMewcarGaTable } from '../adapters/erp5/fee-rules';
import { mewcarGaTableOrNull as orNull } from '../domain/settlement/fee-rules-f04-extra';
/** 뮤카 지급표(프리패스 데이터 수수료 규칙) — 실패해도 null. 저장(접수)은 이 표를 읽지 않는다. */
export const mewcarGaTableOrNull = () => orNull(loadMewcarGaTable);
export { ERP5_PROJECT_ID, erp5Ready } from '../adapters/erp5/firestore';
export { demoMode };

export const today = () => {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
};
