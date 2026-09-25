import type { AdminCatalogReadMode, AdminCatalogReader, AdminCatalogReceipt } from '../../ports/admin-catalog-reader';
import type { CanonicalProduct } from '../../domain/product/types';
import type { Erp5ReadReport } from '../erp5/product-repository';
import type { FreePassDataAdminCatalogMeta } from './admin-catalog-client';

type LegacyCatalogSource = {
  list(): Promise<CanonicalProduct[]>;
  get(id: string): Promise<CanonicalProduct | null>;
  report(): Erp5ReadReport | null;
};
type FreePassCatalogSource = {
  list(): Promise<{ rows: CanonicalProduct[]; meta: FreePassDataAdminCatalogMeta }>;
  get(id: string): Promise<CanonicalProduct | null>;
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
export type ShadowComparison = {
  status: 'MATCH' | 'MISMATCH';
  missingInFreePass: number;
  extraInFreePass: number;
  differentProducts: number;
};

const offerFacts = (p: CanonicalProduct) => p.offers.map((o) => [
  o.supplierId ?? p.supplierId,
  o.termMonths,
  o.monthlyRent,
  o.deposit ?? null,
  o.annualMileageKm ?? null,
].join('|')).sort();

export function compareAdminCatalogShadow(
  legacyRows: CanonicalProduct[],
  freepassRows: CanonicalProduct[],
): ShadowComparison {
  const legacy = new Map(legacyRows.map((p) => [p.id, p]));
  const freepass = new Map(freepassRows.map((p) => [p.id, p]));
  let missingInFreePass = 0, extraInFreePass = 0, differentProducts = 0;
  for (const [id, lp] of legacy) {
    const fp = freepass.get(id);
    if (!fp) { missingInFreePass++; continue; }
    const sameVehicle = (lp.registration?.vehicleNumber ?? '') === (fp.registration?.vehicleNumber ?? '')
      && lp.vehicle.modelId === fp.vehicle.modelId
      && (lp.vehicle.subModelId ?? '') === (fp.vehicle.subModelId ?? '');
    const sameOffers = JSON.stringify(offerFacts(lp)) === JSON.stringify(offerFacts(fp));
    if (!sameVehicle || !sameOffers) differentProducts++;
  }
  for (const id of freepass.keys()) if (!legacy.has(id)) extraInFreePass++;
  return {
    status: missingInFreePass || extraInFreePass || differentProducts ? 'MISMATCH' : 'MATCH',
    missingInFreePass, extraInFreePass, differentProducts,
  };
}

export class AdminCatalogSwitchboard implements AdminCatalogReader {
  private lastReceipt: AdminCatalogReceipt | null = null;

  constructor(
    private readonly legacy: LegacyCatalogSource,
    private readonly freepass?: FreePassCatalogSource,
    private readonly modeOf: () => AdminCatalogReadMode = () => adminCatalogReadMode(),
  ) {}

  mode(): AdminCatalogReadMode { return this.modeOf(); }

  private legacyReceipt(mode: AdminCatalogReadMode, holdReasons?: string[]): AdminCatalogReceipt {
    const r = this.legacy.report();
    return {
      authority: 'FREEPASS_DATA',
      mode,
      servedBy: 'LEGACY_ERP5_BRIDGE',
      cutoverAuthorized: false,
      holdReasons: holdReasons ?? (mode === 'LEGACY_DIRECT'
        ? ['FREEPASS_DATA_ADMIN_CATALOG_CUTOVER_NOT_STARTED']
        : ['FREEPASS_DATA_ADMIN_CATALOG_CONTRACT_NOT_ACTIVE']),
      ...(r ? { legacy: {
        project: r.project, readAt: r.readAt, docs: r.docs, mapped: r.mapped, warnings: r.warnings,
      } } : {}),
    };
  }

  private assertPreCutover(mode: AdminCatalogReadMode) {
    if (mode === 'LEGACY_DIRECT' || mode === 'OBSERVE' || mode === 'SHADOW_READ') return;
    throw new FreePassDataCatalogHoldError(
      `프리패스 데이터 Admin Catalog ${mode}는 parity/fallback/readback 증거가 없다 — legacy ERP5로 조용히 fallback하지 않았다.`,
    );
  }

  async list() {
    const mode = this.mode();
    this.assertPreCutover(mode);
    const rows = await this.legacy.list();
    if (mode !== 'SHADOW_READ') {
      const receipt = this.legacyReceipt(mode);
      this.lastReceipt = receipt;
      return { rows, receipt };
    }

    if (!this.freepass) {
      const receipt: AdminCatalogReceipt = {
        ...this.legacyReceipt(mode, ['FREEPASS_DATA_SHADOW_READER_NOT_CONFIGURED']),
        shadow: {
          status: 'HOLD', comparedAt: new Date().toISOString(),
          missingInFreePass: 0, extraInFreePass: 0, differentProducts: 0,
          reason: 'FREEPASS_DATA_SHADOW_READER_NOT_CONFIGURED',
        },
      };
      this.lastReceipt = receipt;
      return { rows, receipt };
    }

    try {
      const shadow = await this.freepass.list();
      const comparison = compareAdminCatalogShadow(rows, shadow.rows);
      const holds = [
        ...(shadow.meta.policyParity === 'COMPLETE' ? [] : ['FREEPASS_DATA_POLICY_PARITY_INCOMPLETE']),
        ...(comparison.status === 'MATCH' ? [] : ['FREEPASS_DATA_SHADOW_MISMATCH']),
      ];
      const receipt: AdminCatalogReceipt = {
        ...this.legacyReceipt(mode, holds),
        freepass: {
          releaseId: shadow.meta.releaseId, revision: shadow.meta.revision,
          dataDigest: shadow.meta.dataDigest, policyParity: shadow.meta.policyParity,
          rows: shadow.rows.length,
        },
        shadow: { ...comparison, comparedAt: new Date().toISOString() },
      };
      this.lastReceipt = receipt;
      return { rows, receipt };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'FREEPASS_DATA_SHADOW_READ_FAILED';
      const receipt: AdminCatalogReceipt = {
        ...this.legacyReceipt(mode, ['FREEPASS_DATA_SHADOW_READ_FAILED']),
        shadow: {
          status: 'HOLD', comparedAt: new Date().toISOString(),
          missingInFreePass: 0, extraInFreePass: 0, differentProducts: 0, reason,
        },
      };
      this.lastReceipt = receipt;
      return { rows, receipt };
    }
  }

  async get(id: string) {
    const mode = this.mode();
    this.assertPreCutover(mode);
    return this.legacy.get(id);
  }

  receipt(): AdminCatalogReceipt {
    return this.lastReceipt ?? this.legacyReceipt(this.mode());
  }
}
