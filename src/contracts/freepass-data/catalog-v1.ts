/**
 * FreePass Data Catalog V1 read contract.
 *
 * Firestore collection names and legacy aliases are intentionally absent here.
 * Admin accepts only an ACTIVE projection release with version/evidence metadata.
 */
export const FREEPASS_DATA_CATALOG_MAJOR = 1;

export type FreepassDataMoney = { amount: number; currency: 'KRW' };

export type FreepassDataPriceTerm = {
  termKey: string;
  termMonths: number;
  monthlyRent: FreepassDataMoney;
  deposit?: FreepassDataMoney | null;
  depositState: 'KNOWN' | 'ZERO' | 'UNKNOWN' | 'NOT_APPLICABLE';
  mileageLimitKmPerYear?: number | null;
};

export type FreepassDataCatalogProduct = {
  productId: string;
  productRevision: number;
  vehicleModelId: string;
  vehicleAssetId?: string | null;
  displayName: string;
  commercialType: 'NEW_RENT' | 'USED_RENT' | 'NEW_SUBSCRIPTION' | 'USED_SUBSCRIPTION' | 'OGONG_SUBSCRIPTION' | 'PICKUP_SUBSCRIPTION';
  vehicle: {
    maker: string;
    model: string;
    generation?: string | null;
    subModel?: string | null;
    trim?: string | null;
    fuel?: string | null;
    drive?: string | null;
    seats?: number | null;
    assetStatus?: 'AVAILABLE' | 'RESERVED' | 'IN_USE' | 'RETURNED' | 'MAINTENANCE' | 'ACCIDENT' | 'SOLD' | 'RETIRED' | null;
    plateNumber?: string | null;
    odometerKm?: number | null;
  };
  offers: Array<{
    offerId: string;
    supplierId: string;
    offerRevision: number;
    policyId?: string | null;
    priceTerms: FreepassDataPriceTerm[];
  }>;
};

export type FreepassDataCatalogRelease = {
  data: FreepassDataCatalogProduct[];
  meta: {
    schemaVersion: string;
    releaseId: string;
    manifestId: string;
    revision: number;
    inputDigest: string;
    dataDigest: string;
    generatedAt: string;
    activatedAt: string | null;
  };
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const integer = (value: unknown): value is number => finite(value) && Number.isInteger(value);
const commercialTypes = new Set<FreepassDataCatalogProduct['commercialType']>([
  'NEW_RENT', 'USED_RENT', 'NEW_SUBSCRIPTION', 'USED_SUBSCRIPTION', 'OGONG_SUBSCRIPTION', 'PICKUP_SUBSCRIPTION',
]);

function validPriceTerm(value: unknown): value is FreepassDataPriceTerm {
  if (!record(value) || !nonEmpty(value.termKey) || !integer(value.termMonths) || value.termMonths <= 0
    || !record(value.monthlyRent) || !integer(value.monthlyRent.amount) || value.monthlyRent.amount < 0
    || value.monthlyRent.currency !== 'KRW') return false;
  const state = String(value.depositState);
  const deposit = value.deposit;
  if (state === 'KNOWN') {
    return record(deposit) && integer(deposit.amount) && deposit.amount > 0 && deposit.currency === 'KRW';
  }
  if (state === 'ZERO') {
    return record(deposit) && deposit.amount === 0 && deposit.currency === 'KRW';
  }
  return (state === 'UNKNOWN' || state === 'NOT_APPLICABLE') && (deposit === null || deposit === undefined);
}

function validProduct(value: unknown): value is FreepassDataCatalogProduct {
  if (!record(value) || !nonEmpty(value.productId) || !integer(value.productRevision) || value.productRevision < 1
    || !nonEmpty(value.vehicleModelId) || !nonEmpty(value.displayName) || !record(value.vehicle)
    || !commercialTypes.has(value.commercialType as FreepassDataCatalogProduct['commercialType'])
    || !nonEmpty(value.vehicle.maker) || !nonEmpty(value.vehicle.model)
    || !Array.isArray(value.offers) || value.offers.length === 0) return false;
  return value.offers.every((offer) => record(offer) && nonEmpty(offer.offerId) && nonEmpty(offer.supplierId)
    && integer(offer.offerRevision) && offer.offerRevision > 0
    && Array.isArray(offer.priceTerms) && offer.priceTerms.length > 0 && offer.priceTerms.every(validPriceTerm));
}

export function parseCatalogV1(value: unknown): FreepassDataCatalogRelease {
  if (!record(value) || !record(value.meta) || !Array.isArray(value.data)) {
    throw new Error('FreePass Data 응답이 Catalog Release 꼴이 아니다.');
  }
  const meta = value.meta;
  const version = String(meta.schemaVersion ?? '');
  const major = Number(version.split('.')[0]);
  if (major !== FREEPASS_DATA_CATALOG_MAJOR) {
    throw new Error(`지원하지 않는 FreePass Data Catalog 판: ${version || '(없음)'}`);
  }
  for (const key of ['releaseId', 'manifestId', 'inputDigest', 'dataDigest', 'generatedAt'] as const) {
    if (!nonEmpty(meta[key])) throw new Error(`FreePass Data Catalog 메타 누락: ${key}`);
  }
  if (!integer(meta.revision) || meta.revision < 1 || !value.data.every(validProduct)) {
    throw new Error('FreePass Data Catalog 데이터 검증에 실패했다.');
  }
  return value as FreepassDataCatalogRelease;
}
