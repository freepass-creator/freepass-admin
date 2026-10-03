import {
  ADMIN_DATA_CONTRACT,
  type AdminDashboardReadModel,
  type AdminDataPort,
  type AdminDataQuery,
  type AdminDataResult,
  type AdminPermissions,
  type AdminProductSummary,
  type AdminRole,
  type EvidenceField,
} from '../../ports/admin-data';
import { fixtureAudit, fixtureHolds, fixtureProducts, fixtureSources } from './fixtures/admin-data.v1';

const DATASET_REVISION = 'data-r20260921-0130';
const GENERATED_AT = '2026-09-21T01:30:02.000Z';
const SOURCE_OBSERVED_AT = '2026-09-21T01:30:00.000Z';
const STALE_AT = '2026-09-21T03:30:00.000Z';

function permissions(role: AdminRole): AdminPermissions {
  if (role === 'ADMIN') {
    return { role, canViewInternalProvenance: true, canViewSupplierIdentity: true, canViewAudit: true, redactedFields: [] };
  }
  if (role === 'AUDITOR') {
    return { role, canViewInternalProvenance: true, canViewSupplierIdentity: false, canViewAudit: true, redactedFields: ['supplier'] };
  }
  return { role, canViewInternalProvenance: false, canViewSupplierIdentity: true, canViewAudit: false, redactedFields: ['sourceRecordRef', 'audit'] };
}

function redactField<T>(field: EvidenceField<T>, display: string): EvidenceField<T> {
  return { state: 'REDACTED', display, provenance: { ...field.provenance, sourceRecordRef: undefined } };
}

function applyRole(product: AdminProductSummary, role: AdminRole): AdminProductSummary {
  const canSeeInternal = role !== 'OPERATOR';
  const canSeeSupplier = role !== 'AUDITOR';
  return {
    ...product,
    supplier: canSeeSupplier ? product.supplier : redactField(product.supplier, '공급사 비공개'),
    options: role === 'AUDITOR' ? redactField(product.options, '옵션 비공개') : product.options,
    offers: product.offers.map((offer) => ({
      ...offer,
      termMonths: canSeeInternal ? offer.termMonths : { ...offer.termMonths, provenance: { ...offer.termMonths.provenance, sourceRecordRef: undefined } },
      monthlyRent: canSeeInternal ? offer.monthlyRent : { ...offer.monthlyRent, provenance: { ...offer.monthlyRent.provenance, sourceRecordRef: undefined } },
      deposit: canSeeInternal ? offer.deposit : { ...offer.deposit, provenance: { ...offer.deposit.provenance, sourceRecordRef: undefined } },
      annualMileageKm: canSeeInternal ? offer.annualMileageKm : { ...offer.annualMileageKm, provenance: { ...offer.annualMileageKm.provenance, sourceRecordRef: undefined } },
      policies: canSeeInternal ? offer.policies : { ...offer.policies, provenance: { ...offer.policies.provenance, sourceRecordRef: undefined } },
    })),
  };
}

function queryHash(query: AdminDataQuery): string {
  return [query.search.trim().toLowerCase(), query.supplier ?? '*', query.hold ?? '*', query.freshness ?? '*', query.sort].join('|');
}

function encodeCursor(offset: number, hash: string): string {
  return `${DATASET_REVISION}:${offset}:${encodeURIComponent(hash)}`;
}

function decodeCursor(cursor: string | undefined, hash: string): number | null {
  if (!cursor) return 0;
  const [revision, offsetText, encodedHash] = cursor.split(':');
  if (revision !== DATASET_REVISION || decodeURIComponent(encodedHash ?? '') !== hash) return null;
  const offset = Number(offsetText);
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : null;
}

function interpretedConditions(search: string): string[] {
  const compact = search.replaceAll(' ', '').toLowerCase();
  const result: string[] = [];
  if (compact.includes('무보증')) result.push('보증금 0원');
  if (compact.includes('만21세') || compact.includes('21세')) result.push('만 21세');
  if (compact.includes('카드')) result.push('카드결제');
  if (compact.includes('후불')) result.push('후불');
  if (compact.includes('분납')) result.push('보증금 분납');
  return result;
}

function matchesSearch(product: AdminProductSummary, search: string): boolean {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = product.searchTokens.join(' ').toLowerCase().replaceAll(' ', '');
  return terms.every((term) => haystack.includes(term.replaceAll(' ', '')));
}

function sortProducts(products: AdminProductSummary[], sort: AdminDataQuery['sort']): AdminProductSummary[] {
  return products.toSorted((a, b) => {
    if (sort === 'UPDATED_DESC') return b.updatedAt.localeCompare(a.updatedAt);
    if (sort === 'RENT_ASC') {
      const aRent = a.offers[0]?.monthlyRent.value ?? Number.POSITIVE_INFINITY;
      const bRent = b.offers[0]?.monthlyRent.value ?? Number.POSITIVE_INFINITY;
      return aRent - bRent;
    }
    const rank = { EXACT: 0, PARTIAL: 1, UNMATCHED: 2 } as const;
    return rank[a.vehicleMatch] - rank[b.vehicleMatch];
  });
}

function model(query: AdminDataQuery, products: AdminProductSummary[]): AdminDashboardReadModel {
  const access = permissions(query.role);
  const hash = queryHash(query);
  const offset = decodeCursor(query.cursor, hash) ?? 0;
  const pageProducts = products.slice(offset, offset + query.limit).map((product) => applyRole(product, query.role));
  const nextOffset = offset + pageProducts.length;
  const scenario = query.scenario ?? 'NORMAL';
  return {
    contract: ADMIN_DATA_CONTRACT,
    contractVersion: '1.0.0',
    datasetRevision: DATASET_REVISION,
    generatedAt: GENERATED_AT,
    sourceObservedAt: SOURCE_OBSERVED_AT,
    staleAt: STALE_AT,
    freshness: scenario === 'STALE' ? 'STALE' : fixtureSources.some((source) => source.state === 'PARTIAL') ? 'PARTIAL' : 'FRESH',
    partial: scenario === 'STALE' || fixtureSources.some((source) => source.state === 'PARTIAL'),
    permissions: access,
    appliedQuery: { raw: query.search, interpretedConditions: interpretedConditions(query.search), queryHash: hash },
    products: pageProducts,
    page: {
      ...(nextOffset < products.length ? { nextCursor: encodeCursor(nextOffset, hash) } : {}),
      hasNext: nextOffset < products.length,
      totalCount: products.length,
      countAccuracy: 'EXACT',
    },
    sources: fixtureSources.map((source) => scenario === 'STALE' ? { ...source, state: 'STALE', message: 'Fixture STALE 시나리오' } : source),
    holds: fixtureHolds,
    audit: access.canViewAudit ? fixtureAudit : [],
  };
}

export class FixtureAdminDataAdapter implements AdminDataPort {
  async readDashboard(query: AdminDataQuery): Promise<AdminDataResult> {
    if (query.scenario === 'ERROR') {
      return { ok: false, code: 'UPSTREAM_UNAVAILABLE', message: 'Freepass Data fixture upstream unavailable.', retryable: true };
    }
    const hash = queryHash(query);
    if (query.cursor && decodeCursor(query.cursor, hash) === null) {
      return { ok: false, code: 'CURSOR_INVALID', message: '조회 조건 또는 dataset revision이 바뀌어 cursor를 다시 사용할 수 없습니다.', retryable: false };
    }
    let products = fixtureProducts.filter((product) => matchesSearch(product, query.search));
    if (query.supplier) products = products.filter((product) => product.supplier.value === query.supplier);
    if (query.hold && query.hold !== 'ALL') products = products.filter((product) => product.hold === query.hold);
    if (query.freshness && query.freshness !== 'ALL') products = products.filter((product) => product.freshness === query.freshness);
    return { ok: true, data: model(query, sortProducts(products, query.sort)) };
  }

  async readProductDetail(canonicalProductId: string, productRevision: number, role: AdminRole): Promise<AdminDataResult> {
    const product = fixtureProducts.find((candidate) => candidate.canonicalProductId === canonicalProductId);
    if (!product || product.productRevision !== productRevision) {
      return { ok: false, code: 'REVISION_STALE', message: '선택한 상품 revision이 현재 dataset과 일치하지 않습니다.', retryable: false };
    }
    const query: AdminDataQuery = { role, search: '', sort: 'MATCH', limit: 1 };
    return { ok: true, data: model(query, [product]) };
  }

  async readAudit(role: AdminRole): Promise<AdminDataResult> {
    if (role === 'OPERATOR') return { ok: false, code: 'FORBIDDEN', message: '운영자 역할은 audit 원문을 볼 수 없습니다.', retryable: false };
    return { ok: true, data: model({ role, search: '', sort: 'MATCH', limit: 1 }, []) };
  }
}
