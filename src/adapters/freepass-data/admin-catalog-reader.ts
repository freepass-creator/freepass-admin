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
 * Migration behavior:
 * - LEGACY_DIRECT / OBSERVE: return the legacy ERP5 bridge.
 * - SHADOW_READ: read FreePass Data independently, record MATCH/MISMATCH/HOLD, but return legacy rows.
 * - PARITY_VERIFIED / FREEPASS_DATA_READ: fail closed until revision-scoped parity/fallback/readback evidence exists.
 *
 * The generic ERP-public projection is never treated as the Admin contract.
 */
export type ShadowComparison = {
  status: 'MATCH' | 'MISMATCH';
  missingInFreePass: number;
  extraInFreePass: number;
  differentProducts: number;
};

const policyFacts = (values: CanonicalProduct['productPolicies']) => values
  .map((p) => ({
    policyId: p.policyId,
    type: p.type,
    value: Array.isArray(p.value) ? [...p.value].sort() : p.value,
  }))
  .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

const offerFacts = (p: CanonicalProduct) => p.offers.map((o) => ({
  id: o.id,
  supplierId: o.supplierId ?? p.supplierId,
  supplierName: o.supplierName ?? null,
  termMonths: o.termMonths,
  monthlyRent: o.monthlyRent,
  deposit: o.deposit ?? null,
  prepayment: o.prepayment ?? null,
  annualMileageKm: o.annualMileageKm ?? null,
  policyValues: policyFacts(o.policyValues),
})).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

const productFacts = (p: CanonicalProduct) => ({
  supplierId: p.supplierId,
  supplierName: p.supplierName ?? null,
  status: p.status ?? null,
  productKind: p.productKind ?? null,
  consumerPrice: p.consumerPrice ?? null,
  policyState: p.policyState ?? null,
  vehicle: {
    nodeId: p.vehicle.nodeId,
    originId: p.vehicle.originId,
    manufacturerId: p.vehicle.manufacturerId,
    modelId: p.vehicle.modelId,
    subModelId: p.vehicle.subModelId ?? null,
    trimId: p.vehicle.trimId ?? null,
    matchLevel: p.vehicle.matchLevel,
  },
  specs: {
    modelYear: p.specs.modelYear ?? null,
    mileageKm: p.specs.mileageKm ?? null,
    fuel: p.specs.fuel ?? null,
    displacementCc: p.specs.displacementCc ?? null,
    seats: p.specs.seats ?? null,
    drivetrain: p.specs.drivetrain ?? null,
    batteryKwh: p.specs.batteryKwh ?? null,
  },
  registration: {
    vehicleNumber: p.registration?.vehicleNumber ?? null,
    vin: p.registration?.vin ?? null,
    firstRegistrationDate: p.registration?.firstRegistrationDate ?? null,
  },
  offers: offerFacts(p),
  productPolicies: policyFacts(p.productPolicies),
});

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
    if (JSON.stringify(productFacts(lp)) !== JSON.stringify(productFacts(fp))) differentProducts++;
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
