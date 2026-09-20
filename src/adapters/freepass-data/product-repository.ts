import type { CanonicalProduct, PolicyValue, VehicleMatchLevel } from '../../domain/product/types';
import type { ProductRepository } from '../../ports/repositories';

export type FreePassDataAdminCatalogMeta = {
  schemaVersion: string;
  releaseId: string;
  revision: number;
  generatedAt: string;
  activatedAt?: string | null;
};

export type FreePassDataPolicyValue = PolicyValue;

export type FreePassDataAdminCatalogProduct = {
  productId: string;
  productRevision: number;
  sourceProductKey?: string;
  updatedAt?: string;
  displayName: string;
  commercialType: string;
  vehiclePrice?: number;
  vehicleModel: {
    id: string;
    origin?: string | null;
    maker: string;
    model: string;
    generation?: string | null;
    trim?: string | null;
    fuel?: string | null;
    drive?: string | null;
    seats?: number | null;
    modelYear?: number | null;
    displacementCc?: number | null;
    batteryKwh?: number | null;
  };
  vehicleAsset?: {
    id: string;
    status: string;
    plateNumber?: string | null;
    vin?: string | null;
    odometerKm?: number | null;
    firstRegistrationDate?: string | null;
  } | null;
  offers: Array<{
    offerId: string;
    offerRevision: number;
    supplierId: string;
    policyId?: string | null;
    policyValues: FreePassDataPolicyValue[];
    priceTerms: Array<{
      termKey: string;
      termMonths: number;
      monthlyRent: { amount: number; currency: 'KRW' };
      deposit?: { amount: number; currency: 'KRW' } | null;
      depositState: 'KNOWN' | 'ZERO' | 'UNKNOWN' | 'NOT_APPLICABLE';
      mileageLimitKmPerYear?: number | null;
    }>;
  }>;
};

export type FreePassDataAdminCatalogResponse = {
  schema: 'freepass-data.admin-catalog/v1';
  data: FreePassDataAdminCatalogProduct[];
  meta: FreePassDataAdminCatalogMeta;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const nonEmpty = (value: unknown, field: string): string => {
  const text = String(value ?? '').trim();
  if (!text) throw new Error('FREEPASS_DATA_CONTRACT_INVALID:' + field);
  return text;
};

const int = (value: unknown, field: string, min = 0): number => {
  if (!Number.isSafeInteger(value) || Number(value) < min) {
    throw new Error('FREEPASS_DATA_CONTRACT_INVALID:' + field);
  }
  return Number(value);
};

function matchLevel(vehicle: FreePassDataAdminCatalogProduct['vehicleModel']): VehicleMatchLevel {
  if (vehicle.trim) return 'TRIM';
  if (vehicle.generation) return 'SUB_MODEL';
  return vehicle.model ? 'MODEL' : 'UNMATCHED';
}

function assertPolicyValue(value: unknown, where: string): PolicyValue {
  if (!value || typeof value !== 'object') throw new Error('FREEPASS_DATA_CONTRACT_INVALID:' + where);
  const row = value as Record<string, unknown>;
  const policyId = nonEmpty(row.policyId, where + '.policyId');
  const type = nonEmpty(row.type, where + '.type') as PolicyValue['type'];
  const allowed = new Set(['BOOLEAN','NUMBER','MONEY','PERCENTAGE','SINGLE_SELECT','MULTI_SELECT','TEXT','DATE']);
  if (!allowed.has(type)) throw new Error('FREEPASS_DATA_CONTRACT_INVALID:' + where + '.type');
  const raw = row.value;

  if (type === 'BOOLEAN' && typeof raw === 'boolean') return { policyId, type, value: raw };
  if ((type === 'NUMBER' || type === 'MONEY' || type === 'PERCENTAGE') && typeof raw === 'number' && Number.isFinite(raw)) {
    return { policyId, type, value: raw } as PolicyValue;
  }
  if ((type === 'SINGLE_SELECT' || type === 'TEXT' || type === 'DATE') && typeof raw === 'string') {
    return { policyId, type, value: raw } as PolicyValue;
  }
  if (type === 'MULTI_SELECT' && Array.isArray(raw) && raw.every((item) => typeof item === 'string')) {
    return { policyId, type, value: [...raw] };
  }
  throw new Error('FREEPASS_DATA_CONTRACT_INVALID:' + where + '.value');
}

function depositOf(term: FreePassDataAdminCatalogProduct['offers'][number]['priceTerms'][number]): number | undefined {
  if (term.depositState === 'ZERO') return 0;
  if (term.depositState === 'KNOWN') {
    if (!term.deposit || term.deposit.currency !== 'KRW') {
      throw new Error('FREEPASS_DATA_CONTRACT_INVALID:known-deposit-without-krw-value');
    }
    return int(term.deposit.amount, 'deposit.amount');
  }
  // UNKNOWN and NOT_APPLICABLE must never be silently converted to zero.
  return undefined;
}

export function toAdminCanonicalProduct(
  source: FreePassDataAdminCatalogProduct,
  meta: FreePassDataAdminCatalogMeta,
): CanonicalProduct {
  const productId = nonEmpty(source.productId, 'productId');
  const productRevision = int(source.productRevision, 'productRevision', 1);
  const model = source.vehicleModel;
  const maker = nonEmpty(model?.maker, 'vehicleModel.maker');
  const modelName = nonEmpty(model?.model, 'vehicleModel.model');
  const vehicleModelId = nonEmpty(model?.id, 'vehicleModel.id');

  const offers = source.offers.flatMap((offer, offerIndex) => {
    const sourceOfferId = nonEmpty(offer.offerId, 'offers[' + offerIndex + '].offerId');
    const sourceOfferRevision = int(offer.offerRevision, 'offers[' + offerIndex + '].offerRevision', 1);
    const supplierId = nonEmpty(offer.supplierId, 'offers[' + offerIndex + '].supplierId');
    const policyValues = (offer.policyValues ?? []).map((value, index) =>
      assertPolicyValue(value, 'offers[' + offerIndex + '].policyValues[' + index + ']'),
    );

    return (offer.priceTerms ?? []).map((term, termIndex) => {
      const termKey = nonEmpty(term.termKey, 'offers[' + offerIndex + '].priceTerms[' + termIndex + '].termKey');
      const termMonths = int(term.termMonths, 'termMonths', 1);
      if (term.monthlyRent?.currency !== 'KRW') {
        throw new Error('FREEPASS_DATA_CONTRACT_INVALID:monthlyRent.currency');
      }
      const monthlyRent = int(term.monthlyRent.amount, 'monthlyRent.amount');
      const annualMileageKm = term.mileageLimitKmPerYear == null
        ? undefined
        : int(term.mileageLimitKmPerYear, 'mileageLimitKmPerYear');

      return {
        id: sourceOfferId + '#' + termKey,
        supplierId,
        sourceOfferId,
        sourceOfferRevision,
        sourcePriceTermKey: termKey,
        termMonths,
        monthlyRent,
        deposit: depositOf(term),
        depositState: term.depositState,
        ...(annualMileageKm !== undefined ? { annualMileageKm } : {}),
        policyValues: policyValues.map((value) =>
          value.type === 'MULTI_SELECT' ? { ...value, value: [...value.value] } : { ...value },
        ),
      };
    });
  });

  if (!offers.length) throw new Error('FREEPASS_DATA_CONTRACT_INVALID:no-price-terms');

  const uniqueSuppliers = [...new Set(offers.map((offer) => offer.supplierId).filter(Boolean))];
  const asset = source.vehicleAsset ?? undefined;
  const registration = asset && (asset.plateNumber || asset.vin || asset.firstRegistrationDate)
    ? {
        ...(asset.plateNumber ? { vehicleNumber: asset.plateNumber } : {}),
        ...(asset.vin ? { vin: asset.vin } : {}),
        ...(asset.firstRegistrationDate ? { firstRegistrationDate: asset.firstRegistrationDate } : {}),
      }
    : undefined;

  return {
    id: productId,
    version: productRevision,
    // Legacy/default supplier only. The selected Offer supplier is authoritative.
    supplierId: uniqueSuppliers.length === 1 ? uniqueSuppliers[0] : '',
    supplierProductKey: source.sourceProductKey?.trim() || productId,
    commercialType: nonEmpty(source.commercialType, 'commercialType'),
    ...(source.vehiclePrice !== undefined ? { vehiclePrice: int(source.vehiclePrice, 'vehiclePrice') } : {}),
    vehicle: {
      nodeId: vehicleModelId,
      originId: String(model.origin ?? '').trim(),
      manufacturerId: maker,
      modelId: modelName,
      ...(model.generation ? { subModelId: model.generation } : {}),
      ...(model.trim ? { trimId: model.trim } : {}),
      matchLevel: matchLevel(model),
    },
    specs: {
      ...(model.modelYear != null ? { modelYear: int(model.modelYear, 'vehicleModel.modelYear') } : {}),
      ...(asset?.odometerKm != null ? { mileageKm: int(asset.odometerKm, 'vehicleAsset.odometerKm') } : {}),
      ...(model.fuel ? { fuel: model.fuel } : {}),
      ...(model.displacementCc != null ? { displacementCc: int(model.displacementCc, 'vehicleModel.displacementCc') } : {}),
      ...(model.seats != null ? { seats: int(model.seats, 'vehicleModel.seats') } : {}),
      ...(model.drive ? { drivetrain: model.drive } : {}),
      ...(model.batteryKwh != null ? { batteryKwh: int(model.batteryKwh, 'vehicleModel.batteryKwh') } : {}),
    },
    ...(registration ? { registration } : {}),
    offers,
    productPolicies: [
      { policyId: 'commercial_type', type: 'SINGLE_SELECT', value: nonEmpty(source.commercialType, 'commercialType') },
    ],
    sourceSnapshotId: 'freepass-data:' + meta.releaseId + ':' + productId + ':' + productRevision,
    updatedAt: source.updatedAt ?? meta.generatedAt,
  };
}

export class FreePassDataProductRepository implements ProductRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken?: string,
    private readonly fetcher: FetchLike = fetch,
    private readonly path = '/v1/views/admin-catalog/products',
  ) {}

  private async response(): Promise<FreePassDataAdminCatalogResponse> {
    const base = this.baseUrl.replace(/\/$/, '');
    if (!/^https?:\/\//.test(base)) throw new Error('FREEPASS_DATA_BASE_URL_INVALID');
    const response = await this.fetcher(base + this.path, {
      headers: this.serviceToken ? { authorization: 'Bearer ' + this.serviceToken } : undefined,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('FREEPASS_DATA_READ_FAILED:' + response.status);
    const body = await response.json() as Partial<FreePassDataAdminCatalogResponse>;
    if (body.schema !== 'freepass-data.admin-catalog/v1' || !Array.isArray(body.data) || !body.meta) {
      throw new Error('FREEPASS_DATA_CONTRACT_INVALID:envelope');
    }
    nonEmpty(body.meta.releaseId, 'meta.releaseId');
    nonEmpty(body.meta.schemaVersion, 'meta.schemaVersion');
    int(body.meta.revision, 'meta.revision');
    nonEmpty(body.meta.generatedAt, 'meta.generatedAt');
    return body as FreePassDataAdminCatalogResponse;
  }

  async list(): Promise<CanonicalProduct[]> {
    const body = await this.response();
    return body.data.map((product) => toAdminCanonicalProduct(product, body.meta));
  }

  async get(id: string): Promise<CanonicalProduct | null> {
    return (await this.list()).find((product) => product.id === id) ?? null;
  }

  async save(): Promise<CanonicalProduct> {
    throw new Error('FREEPASS_DATA_PRODUCT_WRITE_FORBIDDEN');
  }
}

export function freePassDataProductRepositoryFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: FetchLike = fetch,
): ProductRepository {
  const baseUrl = String(env.FREEPASS_DATA_BASE_URL ?? '').trim();
  if (!baseUrl) throw new Error('FREEPASS_DATA_BASE_URL_REQUIRED');
  const token = String(env.FREEPASS_DATA_SERVICE_TOKEN ?? '').trim() || undefined;
  if (env.NODE_ENV === 'production' && !token) {
    throw new Error('FREEPASS_DATA_SERVICE_TOKEN_REQUIRED');
  }
  return new FreePassDataProductRepository(baseUrl, token, fetcher);
}
