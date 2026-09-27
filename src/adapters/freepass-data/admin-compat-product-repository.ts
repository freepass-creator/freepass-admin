import type { CanonicalProduct } from '../../domain/product/types';
import { indexMaster, type VehicleMasterNode } from '../../domain/product/master-match';
import type { Erp5ReadReport, SkipTally } from '../erp5/product-repository';
import { toCanonicalProduct, type Erp5Doc } from '../erp5/to-canonical';
import { strOf as S } from '../erp5/atom';

type Rec = Record<string, unknown>;

type CompatResponse = {
  schema: 'freepass-data.catalog-compat/v1';
  data: {
    products: Record<string, Rec>;
    policies: Record<string, Rec>;
    vehicleMaster?: Record<string, Rec>;
  };
  meta: {
    consumerId: 'freepass-admin-catalog';
    authority: 'FREEPASS_DATA_COMPATIBILITY_BRIDGE';
    sourceProject: 'freepasserp5';
    observedAt: string;
    collectionCounts: Record<string, number>;
  };
};

const emptySkip = (): SkipTally => ({
  NOT_LISTABLE: 0,
  NO_CAR_NUMBER: 0,
  NO_PRICE: 0,
  NO_VALID_OFFER: 0,
});

const arr = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

function nodeFromCompat(id: string, data: Rec): VehicleMasterNode {
  const trims = new Set<string>();
  for (const trim of arr(data.trims)) if (S(trim)) trims.add(S(trim));
  for (const variant of arr(data.variants)) {
    for (const trim of arr((variant as Rec)?.trims)) if (S(trim)) trims.add(S(trim));
  }
  const year = (value: unknown) => {
    const parsed = Number(String(value ?? '').slice(0, 4));
    return Number.isFinite(parsed) && parsed > 1900 ? parsed : null;
  };
  return {
    id,
    maker: S(data.maker),
    model: S(data.model),
    subModel: S(data.sub_model),
    aliases: arr(data.aliases).map(S).filter(Boolean),
    trims: [...trims],
    yearStart: year(data.year_start),
    yearEnd: year(data.year_end),
  };
}

export function adminCompatibilityTransportConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  try {
    config(env);
    return true;
  } catch {
    return false;
  }
}

function config(env: Record<string, string | undefined> = process.env) {
  const raw = env.FREEPASS_DATA_BASE_URL?.trim().replace(/\/$/, '') ?? '';
  const token = env.FREEPASS_DATA_ADMIN_CATALOG_TOKEN?.trim() ?? '';
  if (!raw || !token) throw new Error('FREEPASS_DATA_COMPAT_CONFIG_MISSING');
  let base: URL;
  try { base = new URL(raw); } catch { throw new Error('FREEPASS_DATA_BASE_URL_INVALID'); }
  if (base.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && base.protocol === 'http:')) {
    throw new Error('FREEPASS_DATA_BASE_URL_INVALID');
  }
  if (base.username || base.password || (base.pathname !== '/' && base.pathname !== '') || base.search || base.hash) {
    throw new Error('FREEPASS_DATA_BASE_URL_MUST_BE_ORIGIN');
  }
  if (token.length < 32) throw new Error('FREEPASS_DATA_ADMIN_CATALOG_TOKEN_INVALID');
  return { base: base.origin, token };
}

/**
 * Admin legacy-shape Catalog transport through FreePass Data.
 *
 * Business meaning remains the existing ERP5 compatibility mapper during migration, but
 * Firebase credentials and collection paths no longer need to exist in the Admin catalog reader.
 */
export class FreePassDataAdminCompatProductRepository {
  private lastReport: Erp5ReadReport | null = null;

  report(): Erp5ReadReport | null { return this.lastReport; }

  private async snapshot(): Promise<CompatResponse> {
    const { base, token } = config();
    const response = await fetch(`${base}/v1/consumers/freepass-admin-catalog/catalog-compat`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`FREEPASS_DATA_COMPAT_HTTP_${response.status}`);
    const body = await response.json() as Partial<CompatResponse>;
    if (
      body.schema !== 'freepass-data.catalog-compat/v1' ||
      body.meta?.consumerId !== 'freepass-admin-catalog' ||
      body.meta?.authority !== 'FREEPASS_DATA_COMPATIBILITY_BRIDGE' ||
      body.meta?.sourceProject !== 'freepasserp5' ||
      !body.data?.products ||
      !body.data?.policies ||
      !body.data?.vehicleMaster ||
      !Number.isFinite(Date.parse(String(body.meta?.observedAt ?? '')))
    ) {
      throw new Error('FREEPASS_DATA_COMPAT_RESPONSE_INVALID');
    }
    return body as CompatResponse;
  }

  async list(): Promise<CanonicalProduct[]> {
    const snapshot = await this.snapshot();
    const master = indexMaster(
      Object.entries(snapshot.data.vehicleMaster ?? {}).map(([id, data]) =>
        nodeFromCompat(id, data)
      )
    );
    const policyBy = new Map<string, Erp5Doc>();
    for (const [id, data] of Object.entries(snapshot.data.policies)) {
      policyBy.set(id, data);
      const code = typeof data.policy_code === 'string' ? data.policy_code.trim() : '';
      if (code) policyBy.set(code, data);
    }

    const rows: CanonicalProduct[] = [];
    const skipped = emptySkip();
    let warnings = 0;
    for (const [docId, data] of Object.entries(snapshot.data.products)) {
      const code = typeof data.policy_code === 'string' ? data.policy_code.trim() : '';
      const result = toCanonicalProduct(
        data,
        docId,
        code ? policyBy.get(code) : undefined,
        `freepass-data-compat:${snapshot.meta.observedAt}:${docId}`,
        master,
        1,
      );
      if (!result.ok) {
        skipped[result.reason] += 1;
        continue;
      }
      if (result.warnings.length) warnings += 1;
      rows.push(result.product);
    }

    this.lastReport = {
      project: 'freepass-data/freepasserp5',
      readAt: snapshot.meta.observedAt,
      docs: Object.keys(snapshot.data.products).length,
      mapped: rows.length,
      skipped,
      warnings,
    };
    return rows;
  }

  async get(id: string): Promise<CanonicalProduct | null> {
    const rows = await this.list();
    return rows.find((row) => row.id === id || row.supplierProductKey === id) ?? null;
  }

  async save(): Promise<CanonicalProduct> {
    throw new Error('상품 Catalog 쓰기는 FreePass Data command 계약을 통해서만 수행할 수 있다.');
  }
}

export const __test = { nodeFromCompat, config };
