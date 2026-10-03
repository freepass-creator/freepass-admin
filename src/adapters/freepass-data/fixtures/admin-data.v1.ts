import type {
  AdminProductSummary,
  AuditReadback,
  CollectionSourceStatus,
  HoldItem,
} from '../../../ports/admin-data';

const observedAt = '2026-09-21T01:30:00.000Z';

function provenance(product: string, field: string, note?: string) {
  return {
    provenanceRef: `prov:${product}:${field}:r7`,
    sourceSnapshotId: 'fp-data-snapshot-20260921-0130',
    observedAt,
    sourceRecordRef: `data-record:${product}:${field}`,
    ...(note ? { note } : {}),
  };
}

export const fixtureProducts: AdminProductSummary[] = [
  {
    canonicalProductId: 'cp-santafe-mx5-001',
    productRevision: 7,
    sourceSnapshotId: 'fp-data-snapshot-20260921-0130',
    provenanceRef: 'prov:cp-santafe-mx5-001:r7',
    supplier: { state: 'KNOWN', value: 'B 렌터카', display: 'B 렌터카', provenance: provenance('cp-santafe-mx5-001', 'supplier') },
    vehicleName: { state: 'KNOWN', value: '싼타페 MX5 캘리그래피', display: '싼타페 MX5 · 캘리그래피', provenance: provenance('cp-santafe-mx5-001', 'vehicle') },
    vehicleMatch: 'EXACT',
    unconfirmedAxes: [],
    status: 'ACTIVE',
    hold: 'CLEAR',
    holdReasons: [],
    freshness: 'FRESH',
    updatedAt: observedAt,
    options: { state: 'KNOWN', value: ['HUD', '서라운드뷰'], display: 'HUD · 서라운드뷰', provenance: provenance('cp-santafe-mx5-001', 'options') },
    photo: { state: 'KNOWN', value: '/fixture/santafe.jpg', display: '대표사진 1장', provenance: provenance('cp-santafe-mx5-001', 'photo') },
    matchedOfferIds: ['of-santafe-36'],
    offers: [
      {
        offerId: 'of-santafe-36',
        termMonths: { state: 'KNOWN', value: 36, display: '36개월', provenance: provenance('cp-santafe-mx5-001', 'term') },
        monthlyRent: { state: 'KNOWN', value: 920000, display: '920,000원', provenance: provenance('cp-santafe-mx5-001', 'rent') },
        deposit: { state: 'KNOWN', value: 0, display: '0원', provenance: provenance('cp-santafe-mx5-001', 'deposit') },
        annualMileageKm: { state: 'KNOWN', value: 20000, display: '연 20,000km', provenance: provenance('cp-santafe-mx5-001', 'mileage') },
        policies: { state: 'KNOWN', value: ['만 21세', '카드결제', '보증금 분납'], display: '만 21세 · 카드결제 · 보증금 분납', provenance: provenance('cp-santafe-mx5-001', 'policies') },
      },
    ],
    searchTokens: ['싼타페', '캘리그래피', 'B 렌터카', '36개월', '무보증', '만21세', '카드결제', '분납'],
  },
  {
    canonicalProductId: 'cp-sonata-002',
    productRevision: 4,
    sourceSnapshotId: 'fp-data-snapshot-20260921-0130',
    provenanceRef: 'prov:cp-sonata-002:r4',
    supplier: { state: 'KNOWN', value: 'A 렌터카', display: 'A 렌터카', provenance: provenance('cp-sonata-002', 'supplier') },
    vehicleName: { state: 'PARTIAL', value: '쏘나타', display: '쏘나타 · 세부모델 미확인', provenance: provenance('cp-sonata-002', 'vehicle', 'MODEL까지만 확정') },
    vehicleMatch: 'PARTIAL',
    unconfirmedAxes: ['SUB_MODEL', 'TRIM'],
    status: 'REVIEW',
    hold: 'HOLD',
    holdReasons: ['보증금 원자 누락', '사진 미확인'],
    freshness: 'PARTIAL',
    updatedAt: '2026-09-21T01:18:00.000Z',
    options: { state: 'PARTIAL', value: ['내비게이션'], display: '내비게이션 · 일부 미확인', provenance: provenance('cp-sonata-002', 'options') },
    photo: { state: 'UNKNOWN', display: '사진 미확인', provenance: provenance('cp-sonata-002', 'photo') },
    matchedOfferIds: ['of-sonata-36'],
    offers: [
      {
        offerId: 'of-sonata-36',
        termMonths: { state: 'KNOWN', value: 36, display: '36개월', provenance: provenance('cp-sonata-002', 'term') },
        monthlyRent: { state: 'KNOWN', value: 690000, display: '690,000원', provenance: provenance('cp-sonata-002', 'rent') },
        deposit: { state: 'UNKNOWN', display: '미확인', provenance: provenance('cp-sonata-002', 'deposit', '빈값을 0원으로 해석하지 않음') },
        annualMileageKm: { state: 'KNOWN', value: 20000, display: '연 20,000km', provenance: provenance('cp-sonata-002', 'mileage') },
        policies: { state: 'KNOWN', value: ['후불'], display: '후불', provenance: provenance('cp-sonata-002', 'policies') },
      },
    ],
    searchTokens: ['쏘나타', 'A 렌터카', '36개월', '후불'],
  },
  {
    canonicalProductId: 'cp-k5-003',
    productRevision: 11,
    sourceSnapshotId: 'fp-data-snapshot-20260921-0130',
    provenanceRef: 'prov:cp-k5-003:r11',
    supplier: { state: 'KNOWN', value: 'C 렌터카', display: 'C 렌터카', provenance: provenance('cp-k5-003', 'supplier') },
    vehicleName: { state: 'KNOWN', value: '더 뉴 K5 DL3 노블레스', display: 'K5 · 노블레스', provenance: provenance('cp-k5-003', 'vehicle') },
    vehicleMatch: 'EXACT',
    unconfirmedAxes: [],
    status: 'REVIEW',
    hold: 'HOLD',
    holdReasons: ['월 대여료 출처 충돌'],
    freshness: 'FRESH',
    updatedAt: '2026-09-21T01:26:00.000Z',
    options: { state: 'KNOWN', value: ['드라이브와이즈'], display: '드라이브와이즈', provenance: provenance('cp-k5-003', 'options') },
    photo: { state: 'KNOWN', value: '/fixture/k5.jpg', display: '대표사진 1장', provenance: provenance('cp-k5-003', 'photo') },
    matchedOfferIds: ['of-k5-24'],
    offers: [
      {
        offerId: 'of-k5-24',
        termMonths: { state: 'KNOWN', value: 24, display: '24개월', provenance: provenance('cp-k5-003', 'term') },
        monthlyRent: { state: 'CONFLICT', display: '780,000원 / 810,000원 충돌', provenance: provenance('cp-k5-003', 'rent', 'Data 검수 필요') },
        deposit: { state: 'KNOWN', value: 0, display: '0원', provenance: provenance('cp-k5-003', 'deposit') },
        annualMileageKm: { state: 'KNOWN', value: 30000, display: '연 30,000km', provenance: provenance('cp-k5-003', 'mileage') },
        policies: { state: 'CONFLICT', value: ['후불', '카드결제'], display: '후불 · 카드결제(충돌)', provenance: provenance('cp-k5-003', 'policies') },
      },
    ],
    searchTokens: ['K5', '노블레스', 'C 렌터카', '24개월', '무보증', '후불', '카드결제'],
  },
  {
    canonicalProductId: 'cp-gv80-004',
    productRevision: 2,
    sourceSnapshotId: 'fp-data-snapshot-20260920-2200',
    provenanceRef: 'prov:cp-gv80-004:r2',
    supplier: { state: 'KNOWN', value: 'D 렌터카', display: 'D 렌터카', provenance: provenance('cp-gv80-004', 'supplier') },
    vehicleName: { state: 'PARTIAL', value: 'GV80', display: 'GV80 · 세부트림 미확인', provenance: provenance('cp-gv80-004', 'vehicle') },
    vehicleMatch: 'PARTIAL',
    unconfirmedAxes: ['TRIM'],
    status: 'ACTIVE',
    hold: 'HOLD',
    holdReasons: ['수집 기준시각 초과'],
    freshness: 'STALE',
    updatedAt: '2026-09-20T22:00:00.000Z',
    options: { state: 'REDACTED', display: '권한에 따라 숨김', provenance: provenance('cp-gv80-004', 'options') },
    photo: { state: 'PARTIAL', display: '외관사진만 확인', provenance: provenance('cp-gv80-004', 'photo') },
    matchedOfferIds: ['of-gv80-48'],
    offers: [
      {
        offerId: 'of-gv80-48',
        termMonths: { state: 'KNOWN', value: 48, display: '48개월', provenance: provenance('cp-gv80-004', 'term') },
        monthlyRent: { state: 'KNOWN', value: 1090000, display: '1,090,000원', provenance: provenance('cp-gv80-004', 'rent') },
        deposit: { state: 'KNOWN', value: 2000000, display: '2,000,000원', provenance: provenance('cp-gv80-004', 'deposit') },
        annualMileageKm: { state: 'UNKNOWN', display: '미확인', provenance: provenance('cp-gv80-004', 'mileage') },
        policies: { state: 'KNOWN', value: ['보증금 분납'], display: '보증금 분납', provenance: provenance('cp-gv80-004', 'policies') },
      },
    ],
    searchTokens: ['GV80', 'D 렌터카', '48개월', '분납'],
  },
];

export const fixtureSources: CollectionSourceStatus[] = [
  { sourceId: 'src-sheet-approved', label: '승인 공급원 피드', state: 'FRESH', lastCollectedAt: observedAt, datasetRevision: 'sheet-r184', message: 'Freepass Data 정제 완료' },
  { sourceId: 'src-erp-approved', label: '승인 ERP 피드', state: 'PARTIAL', lastCollectedAt: '2026-09-21T01:18:00.000Z', datasetRevision: 'erp-r92', message: '2개 필드 검수 대기' },
  { sourceId: 'src-photo-feed', label: '상품 사진 피드', state: 'STALE', lastCollectedAt: '2026-09-20T22:00:00.000Z', datasetRevision: 'photo-r31', message: '신선도 기준 2시간 초과' },
];

export const fixtureHolds: HoldItem[] = [
  { holdId: 'hold-101', canonicalProductId: 'cp-sonata-002', severity: 'MAJOR', category: 'MISSING', field: 'offer.deposit', message: '보증금 미확인 — 0원으로 표시 금지', provenanceRef: 'prov:cp-sonata-002:deposit:r7' },
  { holdId: 'hold-102', canonicalProductId: 'cp-k5-003', severity: 'CRITICAL', category: 'CONFLICT', field: 'offer.monthlyRent', message: '월 대여료 두 값 충돌', provenanceRef: 'prov:cp-k5-003:rent:r7' },
  { holdId: 'hold-103', canonicalProductId: 'cp-gv80-004', severity: 'MAJOR', category: 'STALE', field: 'product', message: '상품 수집 기준시각 초과', provenanceRef: 'prov:cp-gv80-004:r2' },
];

export const fixtureAudit: AuditReadback[] = [
  { eventId: 'evt-701', occurredAt: '2026-09-21T01:30:02.000Z', actor: 'freepass-data', action: 'DATASET_PUBLISHED', entityRef: 'dataset:admin-v1', revision: 'data-r20260921-0130', result: 'APPLIED' },
  { eventId: 'evt-700', occurredAt: '2026-09-21T01:27:11.000Z', actor: 'reviewer:data', action: 'FIELD_CONFLICT_REGISTERED', entityRef: 'cp-k5-003:offer.monthlyRent', revision: '11', result: 'HOLD' },
  { eventId: 'evt-699', occurredAt: '2026-09-21T01:19:08.000Z', actor: 'freepass-data', action: 'PARTIAL_PRODUCT_PUBLISHED', entityRef: 'cp-sonata-002', revision: '4', result: 'HOLD' },
];
