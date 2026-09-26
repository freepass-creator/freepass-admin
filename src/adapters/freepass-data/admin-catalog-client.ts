import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CanonicalProduct, Offer, PolicyValue } from '../../domain/product/types';

const Money = z.object({ amount: z.number().int().nonnegative(), currency: z.literal('KRW') });
const PolicyValueSchema = z.discriminatedUnion('type', [
  z.object({ policyId: z.string().min(1), type: z.literal('BOOLEAN'), value: z.boolean() }),
  z.object({ policyId: z.string().min(1), type: z.literal('NUMBER'), value: z.number() }),
  z.object({ policyId: z.string().min(1), type: z.literal('MONEY'), value: z.number() }),
  z.object({ policyId: z.string().min(1), type: z.literal('PERCENTAGE'), value: z.number() }),
  z.object({ policyId: z.string().min(1), type: z.literal('SINGLE_SELECT'), value: z.string() }),
  z.object({ policyId: z.string().min(1), type: z.literal('MULTI_SELECT'), value: z.array(z.string()) }),
  z.object({ policyId: z.string().min(1), type: z.literal('TEXT'), value: z.string() }),
  z.object({ policyId: z.string().min(1), type: z.literal('DATE'), value: z.string() }),
]);
const PriceTerm = z.object({
  termKey: z.string().min(1),
  termMonths: z.number().int().positive(),
  monthlyRent: Money,
  deposit: Money.nullish(),
  depositState: z.enum(['KNOWN','ZERO','UNKNOWN','NOT_APPLICABLE']),
  mileageLimitKmPerYear: z.number().int().nonnegative().nullish(),
}).superRefine((value, ctx) => {
  if (value.depositState === 'KNOWN' && !value.deposit) {
    ctx.addIssue({ code: 'custom', message: 'KNOWN deposit requires amount' });
  }
  if (value.depositState === 'ZERO' && value.deposit?.amount !== 0) {
    ctx.addIssue({ code: 'custom', message: 'ZERO deposit requires 0 KRW' });
  }
  if ((value.depositState === 'UNKNOWN' || value.depositState === 'NOT_APPLICABLE') && value.deposit) {
    ctx.addIssue({ code: 'custom', message: 'unknown/not-applicable deposit cannot carry amount' });
  }
});
const DataOffer = z.object({
  offerId: z.string().min(1),
  offerRevision: z.number().int().positive(),
  supplierId: z.string().min(1),
  policyId: z.string().nullish(),
  policyState: z.enum(['COMPLETE','MISSING','INVALID']),
  policyValues: z.array(PolicyValueSchema),
  invalidPolicyFactRefs: z.array(z.string()),
  priceTerms: z.array(PriceTerm).min(1),
}).passthrough();
const DataProduct = z.object({
  productId: z.string().min(1),
  productRevision: z.number().int().positive(),
  updatedAt: z.string().min(1),
  displayName: z.string().min(1),
  commercialType: z.enum([
    'NEW_RENT','USED_RENT','NEW_SUBSCRIPTION','USED_SUBSCRIPTION','OGONG_SUBSCRIPTION','PICKUP_SUBSCRIPTION',
  ]),
  vehicleModel: z.object({
    id: z.string().min(1), maker: z.string().min(1), model: z.string().min(1),
    origin: z.string().nullish(),
    generation: z.string().nullish(), subModel: z.string().nullish(), trim: z.string().nullish(),
    fuel: z.string().nullish(), drive: z.string().nullish(), seats: z.number().int().positive().nullish(),
    modelYear: z.number().int().min(1900).nullish(),
    displacementCc: z.number().int().nonnegative().nullish(),
    batteryKwh: z.number().nonnegative().nullish(),
  }).passthrough(),
  vehicleAsset: z.object({
    id: z.string().min(1), status: z.enum(['AVAILABLE','RESERVED','IN_USE','RETURNED','MAINTENANCE','ACCIDENT','SOLD','RETIRED']),
    plateNumber: z.string().nullish(), vin: z.string().nullish(), odometerKm: z.number().int().nonnegative().nullish(),
    firstRegistrationDate: z.string().nullish(),
  }).nullish(),
  offers: z.array(DataOffer).min(1),
  vehiclePrice: z.number().int().nonnegative().nullish(),
}).passthrough();
const ResponseSchema = z.object({
  schema: z.literal('freepass-data.admin-catalog/v1'),
  data: z.array(DataProduct).min(1),
  meta: z.object({
    consumerId: z.literal('freepass-admin-catalog'),
    projectionId: z.literal('admin-catalog'),
    authority: z.literal('CANONICAL_ACTIVE'),
    schemaVersion: z.literal('1.0.0'),
    releaseId: z.string().min(1),
    manifestId: z.string().min(1),
    inputDigest: z.string().min(1),
    dataDigest: z.string().min(1),
    revision: z.number().int().nonnegative(),
    generatedAt: z.string().min(1),
    activatedAt: z.string().min(1),
    policyParity: z.enum(['COMPLETE','INCOMPLETE']),
    missingPolicyOfferIds: z.array(z.string()),
    invalidPolicyFactRefs: z.array(z.string()),
  }).passthrough(),
}).passthrough();

export type FreePassDataAdminCatalogMeta = z.infer<typeof ResponseSchema>['meta'];

const kindOf: Record<z.infer<typeof DataProduct>['commercialType'], string> = {
  NEW_RENT: '신차렌트',
  USED_RENT: '중고렌트',
  NEW_SUBSCRIPTION: '신차구독',
  USED_SUBSCRIPTION: '중고구독',
  OGONG_SUBSCRIPTION: '오공구독',
  PICKUP_SUBSCRIPTION: '픽업구독',
};
const policyCopy = (values: z.infer<typeof PolicyValueSchema>[]): PolicyValue[] =>
  values.map((p) => p.type === 'MULTI_SELECT' ? { ...p, value: [...p.value] } : { ...p }) as PolicyValue[];

const policySnapshotFacts = (values: z.infer<typeof PolicyValueSchema>[]) => values
  .map((p) => ({
    policyId: p.policyId,
    type: p.type,
    value: Array.isArray(p.value) ? [...p.value].sort() : p.value,
  }))
  .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

function sourceSnapshotDigest(source: z.infer<typeof DataProduct>): string {
  const facts = {
    productId: source.productId,
    productRevision: source.productRevision,
    commercialType: source.commercialType,
    vehiclePrice: source.vehiclePrice ?? null,
    vehicleModel: source.vehicleModel,
    vehicleAsset: source.vehicleAsset ?? null,
    offers: source.offers.map((offer) => ({
      offerId: offer.offerId,
      offerRevision: offer.offerRevision,
      supplierId: offer.supplierId,
      policyId: offer.policyId ?? null,
      policyState: offer.policyState,
      invalidPolicyFactRefs: [...offer.invalidPolicyFactRefs].sort(),
      policyValues: policySnapshotFacts(offer.policyValues),
      priceTerms: offer.priceTerms.map((term) => ({
        termKey: term.termKey,
        termMonths: term.termMonths,
        monthlyRent: term.monthlyRent,
        deposit: term.deposit ?? null,
        depositState: term.depositState,
        mileageLimitKmPerYear: term.mileageLimitKmPerYear ?? null,
      })).sort((a, b) => a.termKey.localeCompare(b.termKey)),
    })).sort((a, b) => a.offerId.localeCompare(b.offerId) || a.offerRevision - b.offerRevision),
  };
  return createHash('sha256').update(JSON.stringify(facts)).digest('hex');
}

function mapProduct(source: z.infer<typeof DataProduct>): CanonicalProduct {
  const offers: Offer[] = source.offers.flatMap((offer) => offer.priceTerms.map((term) => ({
    id: `${offer.offerId}#${term.termKey}`,
    supplierId: offer.supplierId,
    termMonths: term.termMonths,
    monthlyRent: term.monthlyRent.amount,
    ...(term.depositState === 'KNOWN' || term.depositState === 'ZERO' ? { deposit: term.deposit?.amount } : {}),
    ...(term.mileageLimitKmPerYear !== null && term.mileageLimitKmPerYear !== undefined
      ? { annualMileageKm: term.mileageLimitKmPerYear } : {}),
    policyValues: policyCopy(offer.policyValues),
  })));
  const supplierIds = [...new Set(source.offers.map((o) => o.supplierId))];
  const sourceSnapshotId = 'freepass-data:' + sourceSnapshotDigest(source);
  const vm = source.vehicleModel;
  const matchLevel = vm.trim ? 'TRIM' : vm.subModel ? 'SUB_MODEL' : vm.model ? 'MODEL' : 'UNMATCHED';
  const policyStates = source.offers.map((o) => o.policyState);
  const policyState = policyStates.every((s) => s === 'COMPLETE')
    ? 'CONFIRMED' as const
    : policyStates.some((s) => s === 'MISSING') ? 'MISSING' as const : undefined;

  return {
    id: source.productId,
    version: source.productRevision,
    supplierId: supplierIds.length === 1 ? supplierIds[0]! : '',
    productKind: kindOf[source.commercialType],
    ...(source.vehiclePrice !== null && source.vehiclePrice !== undefined ? { consumerPrice: source.vehiclePrice } : {}),
    ...(policyState ? { policyState } : {}),
    supplierProductKey: source.productId,
    vehicle: {
      nodeId: vm.id, originId: vm.origin ?? '', manufacturerId: vm.maker, modelId: vm.model,
      ...(vm.subModel ? { subModelId: vm.subModel } : {}),
      ...(vm.trim ? { trimId: vm.trim } : {}),
      matchLevel,
    },
    specs: {
      ...(vm.modelYear !== null && vm.modelYear !== undefined ? { modelYear: vm.modelYear } : {}),
      ...(vm.fuel ? { fuel: vm.fuel } : {}),
      ...(vm.displacementCc !== null && vm.displacementCc !== undefined ? { displacementCc: vm.displacementCc } : {}),
      ...(vm.seats !== null && vm.seats !== undefined ? { seats: vm.seats } : {}),
      ...(vm.drive ? { drivetrain: vm.drive } : {}),
      ...(vm.batteryKwh !== null && vm.batteryKwh !== undefined ? { batteryKwh: vm.batteryKwh } : {}),
      ...(source.vehicleAsset?.odometerKm !== null && source.vehicleAsset?.odometerKm !== undefined
        ? { mileageKm: source.vehicleAsset.odometerKm } : {}),
    },
    ...(source.vehicleAsset ? { registration: {
      ...(source.vehicleAsset.plateNumber ? { vehicleNumber: source.vehicleAsset.plateNumber } : {}),
      ...(source.vehicleAsset.vin ? { vin: source.vehicleAsset.vin } : {}),
      ...(source.vehicleAsset.firstRegistrationDate ? { firstRegistrationDate: source.vehicleAsset.firstRegistrationDate } : {}),
    } } : {}),
    offers,
    productPolicies: [],
    sourceSnapshotId,
    updatedAt: source.updatedAt,
  };
}

function config() {
  const raw = process.env.FREEPASS_DATA_BASE_URL?.trim().replace(/\/$/, '') ?? '';
  const token = process.env.FREEPASS_DATA_ADMIN_CATALOG_TOKEN?.trim() ?? '';
  if (!raw || !token) throw new Error('FREEPASS_DATA_SHADOW_CONFIG_MISSING');
  let base: URL;
  try { base = new URL(raw); } catch { throw new Error('FREEPASS_DATA_BASE_URL_INVALID'); }
  if (!['http:','https:'].includes(base.protocol)) throw new Error('FREEPASS_DATA_BASE_URL_INVALID');
  if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') throw new Error('FREEPASS_DATA_BASE_URL_MUST_BE_HTTPS');
  if (token.length < 32) throw new Error('FREEPASS_DATA_ADMIN_CATALOG_TOKEN_INVALID');
  return { base: base.toString().replace(/\/$/, ''), token };
}

export class FreePassDataAdminCatalogClient {
  private lastMeta: FreePassDataAdminCatalogMeta | null = null;
  meta() { return this.lastMeta; }

  async list(): Promise<{ rows: CanonicalProduct[]; meta: FreePassDataAdminCatalogMeta }> {
    const { base, token } = config();
    const response = await fetch(`${base}/v1/consumers/freepass-admin-catalog/catalog`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`FREEPASS_DATA_HTTP_${response.status}`);
    const parsed = ResponseSchema.parse(await response.json());
    this.lastMeta = parsed.meta;
    return { rows: parsed.data.map(mapProduct), meta: parsed.meta };
  }

  async get(id: string): Promise<CanonicalProduct | null> {
    const { rows } = await this.list();
    return rows.find((row) => row.id === id) ?? null;
  }
}

export const __test = { ResponseSchema, mapProduct };
