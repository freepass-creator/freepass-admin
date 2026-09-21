import type { ProductRepository } from '../../ports/repositories';
import type { CanonicalProduct, Offer } from '../../domain/product/types';
import { parseCatalogV1, type FreepassDataCatalogProduct, type FreepassDataCatalogRelease } from '../../contracts/freepass-data/catalog-v1';

export type FreepassDataReadReport = FreepassDataCatalogRelease['meta'] & {
  source: 'freepass-data';
  endpoint: string;
  products: number;
};

const KIND: Record<FreepassDataCatalogProduct['commercialType'], string> = {
  NEW_RENT: '신차렌트', USED_RENT: '중고렌트', NEW_SUBSCRIPTION: '신차구독',
  USED_SUBSCRIPTION: '중고구독', OGONG_SUBSCRIPTION: '오공구독', PICKUP_SUBSCRIPTION: '픽업구독',
};

function toOffer(product: FreepassDataCatalogProduct): Offer[] {
  return product.offers.flatMap((offer) => offer.priceTerms.map((term) => ({
    id: `${offer.offerId}:${term.termKey}`,
    termMonths: term.termMonths,
    monthlyRent: term.monthlyRent.amount,
    ...(term.depositState === 'ZERO' ? { deposit: 0 }
      : term.depositState === 'KNOWN' && term.deposit ? { deposit: term.deposit.amount } : {}),
    ...(typeof term.mileageLimitKmPerYear === 'number' ? { annualMileageKm: term.mileageLimitKmPerYear } : {}),
    policyValues: [],
  })));
}

export function toAdminProduct(product: FreepassDataCatalogProduct, release: FreepassDataCatalogRelease['meta']): CanonicalProduct {
  const v = product.vehicle;
  const supplierIds = [...new Set(product.offers.map((offer) => offer.supplierId))];
  if (supplierIds.length !== 1) {
    throw new Error(`FreePass Admin 상품 모델은 공급사 하나만 지원한다: ${product.productId}`);
  }
  return {
    id: product.productId,
    version: product.productRevision,
    supplierId: supplierIds[0],
    supplierProductKey: product.vehicleAssetId ?? product.productId,
    productKind: KIND[product.commercialType],
    vehicle: {
      nodeId: product.vehicleModelId,
      originId: product.vehicleModelId,
      manufacturerId: v.maker,
      modelId: v.model,
      ...(v.subModel || v.generation ? { subModelId: v.subModel ?? v.generation ?? undefined } : {}),
      ...(v.trim ? { trimId: v.trim } : {}),
      matchLevel: 'UNMATCHED',
      matchNote: 'FreePass Data Catalog V1에는 Admin 차종마스터 매칭 깊이 증거가 없다.',
    },
    specs: {
      ...(v.fuel ? { fuel: v.fuel } : {}),
      ...(v.drive ? { drivetrain: v.drive } : {}),
      ...(typeof v.seats === 'number' ? { seats: v.seats } : {}),
      ...(typeof v.odometerKm === 'number' ? { mileageKm: v.odometerKm } : {}),
    },
    ...(v.plateNumber ? { registration: { vehicleNumber: v.plateNumber } } : {}),
    offers: toOffer(product),
    productPolicies: [],
    sourceSnapshotId: release.releaseId,
    updatedAt: release.activatedAt ?? release.generatedAt,
  };
}

export class FreepassDataProductRepository implements ProductRepository {
  private lastReport: FreepassDataReadReport | null = null;

  constructor(private readonly endpoint = process.env.FREEPASS_DATA_CATALOG_URL?.trim()
    || 'http://127.0.0.1:8787/v1/views/erp-public/products') {}

  report() { return this.lastReport; }

  private async release(): Promise<FreepassDataCatalogRelease> {
    let response: Response;
    try { response = await fetch(this.endpoint, { cache: 'no-store', signal: AbortSignal.timeout(5_000) }); }
    catch (error) { throw new Error(`FreePass Data Catalog 연결 실패 — ${(error as Error).message}`); }
    if (!response.ok) throw new Error(`FreePass Data Catalog 응답 실패: HTTP ${response.status}`);
    const release = parseCatalogV1(await response.json());
    this.lastReport = { source: 'freepass-data', endpoint: this.endpoint, products: release.data.length, ...release.meta };
    return release;
  }

  async list(): Promise<CanonicalProduct[]> {
    const release = await this.release();
    return release.data.map((product) => toAdminProduct(product, release.meta));
  }

  async get(id: string): Promise<CanonicalProduct | null> {
    const release = await this.release();
    const product = release.data.find((row) => row.productId === id);
    return product ? toAdminProduct(product, release.meta) : null;
  }

  async save(): Promise<CanonicalProduct> {
    throw new Error('FreePass Data Catalog 읽기 계약은 쓰기를 허용하지 않는다.');
  }
}
