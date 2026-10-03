export const ADMIN_DATA_CONTRACT = 'freepass-data.admin-read-model/v1' as const;

export type AdminRole = 'ADMIN' | 'OPERATOR' | 'AUDITOR';
export type FieldState = 'KNOWN' | 'UNKNOWN' | 'CONFLICT' | 'PARTIAL' | 'REDACTED';
export type FreshnessState = 'FRESH' | 'STALE' | 'PARTIAL' | 'ERROR';
export type HoldState = 'CLEAR' | 'HOLD';
export type ProductSort = 'MATCH' | 'RENT_ASC' | 'UPDATED_DESC';

export interface FieldProvenance {
  provenanceRef: string;
  sourceSnapshotId: string;
  observedAt: string;
  sourceRecordRef?: string;
  note?: string;
}

export interface EvidenceField<T> {
  state: FieldState;
  value?: T;
  display: string;
  provenance: FieldProvenance;
}

export interface RefinedOffer {
  offerId: string;
  termMonths: EvidenceField<number>;
  monthlyRent: EvidenceField<number>;
  deposit: EvidenceField<number>;
  annualMileageKm: EvidenceField<number>;
  policies: EvidenceField<string[]>;
}

export interface AdminProductSummary {
  canonicalProductId: string;
  productRevision: number;
  sourceSnapshotId: string;
  provenanceRef: string;
  supplier: EvidenceField<string>;
  vehicleName: EvidenceField<string>;
  vehicleMatch: 'EXACT' | 'PARTIAL' | 'UNMATCHED';
  unconfirmedAxes: string[];
  status: 'ACTIVE' | 'ENDED' | 'REVIEW';
  hold: HoldState;
  holdReasons: string[];
  freshness: FreshnessState;
  updatedAt: string;
  options: EvidenceField<string[]>;
  photo: EvidenceField<string>;
  matchedOfferIds: string[];
  offers: RefinedOffer[];
  searchTokens: string[];
}

export interface CollectionSourceStatus {
  sourceId: string;
  label: string;
  state: FreshnessState;
  lastCollectedAt?: string;
  datasetRevision?: string;
  message: string;
}

export interface HoldItem {
  holdId: string;
  canonicalProductId?: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  category: 'MISSING' | 'CONFLICT' | 'PARTIAL' | 'STALE';
  field: string;
  message: string;
  provenanceRef: string;
}

export interface AuditReadback {
  eventId: string;
  occurredAt: string;
  actor: string;
  action: string;
  entityRef: string;
  revision: string;
  result: 'APPLIED' | 'HOLD' | 'REJECTED';
}

export interface AdminPermissions {
  role: AdminRole;
  canViewInternalProvenance: boolean;
  canViewSupplierIdentity: boolean;
  canViewAudit: boolean;
  redactedFields: string[];
}

export interface AdminDataQuery {
  role: AdminRole;
  search: string;
  supplier?: string;
  hold?: HoldState | 'ALL';
  freshness?: FreshnessState | 'ALL';
  sort: ProductSort;
  cursor?: string;
  limit: number;
  scenario?: 'NORMAL' | 'STALE' | 'ERROR';
}

export interface AppliedQuery {
  raw: string;
  interpretedConditions: string[];
  queryHash: string;
}

export interface CursorPage {
  nextCursor?: string;
  hasNext: boolean;
  totalCount: number;
  countAccuracy: 'EXACT' | 'ESTIMATED';
}

export interface AdminDashboardReadModel {
  contract: typeof ADMIN_DATA_CONTRACT;
  contractVersion: '1.0.0';
  datasetRevision: string;
  generatedAt: string;
  sourceObservedAt: string;
  staleAt: string;
  freshness: FreshnessState;
  partial: boolean;
  permissions: AdminPermissions;
  appliedQuery: AppliedQuery;
  products: AdminProductSummary[];
  page: CursorPage;
  sources: CollectionSourceStatus[];
  holds: HoldItem[];
  audit: AuditReadback[];
}

export type AdminDataErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONTRACT_VERSION_UNSUPPORTED'
  | 'REVISION_STALE'
  | 'CURSOR_INVALID'
  | 'PARTIAL_DATA'
  | 'UPSTREAM_UNAVAILABLE';

export type AdminDataResult =
  | { ok: true; data: AdminDashboardReadModel }
  | { ok: false; code: AdminDataErrorCode; message: string; retryable: boolean };

export interface AdminDataPort {
  readDashboard(query: AdminDataQuery): Promise<AdminDataResult>;
  readProductDetail(
    canonicalProductId: string,
    productRevision: number,
    role: AdminRole,
  ): Promise<AdminDataResult>;
  readAudit(role: AdminRole, cursor?: string): Promise<AdminDataResult>;
}
