import type { AdminCatalogReadMode, AdminCatalogReader, AdminCatalogReceipt } from '../../ports/admin-catalog-reader';
import type { CanonicalProduct } from '../../domain/product/types';
import type { Erp5ReadReport } from '../erp5/product-repository';

type LegacyCatalogSource = {
  list(): Promise<CanonicalProduct[]>;
  get(id: string): Promise<CanonicalProduct | null>;
  report(): Erp5ReadReport | null;
};

const allowed = new Set<AdminCatalogReadMode>([
  'LEGACY_DIRECT', 'OBSERVE', 'SHADOW_READ', 'PARITY_VERIFIED', 'FREEPASS_DATA_READ',
]);

/**
 * Central switch key defined by FreePass Data consumer switchboard.
 * Current approved Admin stage is OBSERVE until an Admin-specific consumer contract,
 * ACTIVE Release, policy parity and authenticated runtime evidence exist.
 */
export function adminCatalogReadMode(raw = process.env.FREEPASS_DATA_ADMIN_CATALOG_READ_MODE): AdminCatalogReadMode {
  const value = (raw ?? 'OBSERVE').trim() || 'OBSERVE';
  if (!allowed.has(value as AdminCatalogReadMode)) {
    throw new Error(`모르는 프리패스 데이터 Admin Catalog 모드: ${value}`);
  }
  return value as AdminCatalogReadMode;
}

export class FreePassDataCatalogHoldError extends Error {
  readonly code = 'FREEPASS_DATA_ADMIN_CATALOG_HOLD';
}

/**
 * Migration switchboard.
 *
 * Today:
 * - LEGACY_DIRECT / OBSERVE: return the legacy ERP5 bridge, but authority remains FreePass Data.
 * - SHADOW_READ and later: fail closed until the Admin consumer contract is actually implemented.
 *
 * We deliberately do not pretend that the generic ERP-public projection is an Admin contract,
 * and we never silently fall back once a later switch is requested.
 */
export class AdminCatalogSwitchboard implements AdminCatalogReader {
  constructor(
    private readonly legacy: LegacyCatalogSource,
    private readonly modeOf: () => AdminCatalogReadMode = () => adminCatalogReadMode(),
  ) {}

  mode(): AdminCatalogReadMode { return this.modeOf(); }

  private legacyReceipt(mode: AdminCatalogReadMode): AdminCatalogReceipt {
    const r = this.legacy.report();
    return {
      authority: 'FREEPASS_DATA',
      mode,
      servedBy: 'LEGACY_ERP5_BRIDGE',
      cutoverAuthorized: false,
      holdReasons: mode === 'LEGACY_DIRECT'
        ? ['FREEPASS_DATA_ADMIN_CATALOG_CUTOVER_NOT_STARTED']
        : ['FREEPASS_DATA_ADMIN_CATALOG_CONTRACT_NOT_ACTIVE'],
      ...(r ? { legacy: {
        project: r.project, readAt: r.readAt, docs: r.docs, mapped: r.mapped, warnings: r.warnings,
      } } : {}),
    };
  }

  private assertLegacyMode(mode: AdminCatalogReadMode) {
    if (mode === 'LEGACY_DIRECT' || mode === 'OBSERVE') return;
    throw new FreePassDataCatalogHoldError(
      `프리패스 데이터 Admin Catalog ${mode}는 아직 활성 계약이 없다 — legacy ERP5로 조용히 fallback하지 않았다.`,
    );
  }

  async list() {
    const mode = this.mode();
    this.assertLegacyMode(mode);
    const rows = await this.legacy.list();
    return { rows, receipt: this.legacyReceipt(mode) };
  }

  async get(id: string) {
    const mode = this.mode();
    this.assertLegacyMode(mode);
    return this.legacy.get(id);
  }

  receipt(): AdminCatalogReceipt {
    return this.legacyReceipt(this.mode());
  }
}
