export type ContractHandoffSource = {
  intakeId: string;
  sourceDigest: string;
  customerName: string;
  vehicleName: string;
  plate: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  rent: number | null;
  termMonths: number | null;
  deposit: number | null;
  sourceProductId: string | null;
  sourceProductVersion: number | null;
  sourceOfferId: string | null;
  sourceSnapshotId: string | null;
  catalogSnapshot: Record<string, unknown> | null;
};

export type EsignSessionStatus =
  | 'sent' | 'opened' | 'in_progress' | 'submitting' | 'pending_review'
  | 'rejected' | 'approving' | 'signed' | 'revoked';

export type EsignTone = 'grey' | 'navy' | 'amber' | 'green' | 'red';

export type ConsentAtom = {
  key: string;
  label: string;
  required: boolean;
  items: string[];
  purpose: string;
  retention: string;
  refusalNote?: string;
};

export type ConsentProfile = {
  version: string;
  requiredKeys: string[];
  atoms: ConsentAtom[];
  gpsInstalled: '장착' | '미장착';
  paymentMethod: '계좌이체' | 'CMS 자동이체';
  screeningCriteria: '무심사' | '소득확인';
  cmsRequiredBeforeHandover: boolean;
};

export type EsignRequiredDocument = {
  key: string;
  label: string;
  note: string;
  required: boolean;
};

export type EsignSnapshot = {
  contractId: string;
  contractCode: string;
  customerName: string;
  customerPhone: string;
  customerType: '개인' | '개인사업자' | '법인';
  vehicleName: string;
  plate: string;
  supplierCode: string;
  supplierName: string;
  contractKind: string;
  insuranceSide: string;
  rent: number | null;
  termMonths: number | null;
  deposit: number | null;
  contractDate: string;
  templateVersion: string;
  agreementVersion: string;
  templateState: Record<string, string>;
  templateFields: Record<string, string>;
  requiredDocuments: EsignRequiredDocument[];
  consentProfile: ConsentProfile;
};

export type EsignSession = {
  id: string;
  contractId: string;
  contractCode: string;
  tokenHash: string;
  status: EsignSessionStatus;
  revision: number;
  issuedAt: number;
  issuedBy: string;
  expiresAt: number;
  openedAt?: number;
  submittedAt?: number;
  submittingAt?: number;
  approvedAt?: number;
  approvingAt?: number;
  revokedAt?: number;
  rejectedAt?: number;
  rejectReason?: string;
  supplementItems?: string[];
  progress: Record<string, number>;
  snapshot: EsignSnapshot;
  signedSnapshot?: Record<string, unknown>;
  sealHash?: string;
  documentSha256?: string;
  documentStoragePath?: string;
  documentContentType?: string;
  finalizationId?: string;
  approvedBy?: string;
};

export type EsignPrivateSubmission = {
  sessionId: string;
  contractId: string;
  customerName: string;
  customerPhone: string;
  customerBirth?: string;
  customerAddress: string;
  driverLicenseNo?: string;
  signerName?: string;
  signerRole?: string;
  cms?: {
    holderName: string; holderRelation: string; holderPhone: string;
    bank: string; accountNo: string; holderIdentifier: string;
  };
  emergencyRelation: string;
  emergencyName: string;
  emergencyPhone: string;
  consents: string[];
  consentTimes: Record<string, number>;
  sectionConfirmations: Record<string, number>;
  summaryConfirmedAt: number;
  agreementReadAt: number;
  signaturePath: string;
  signatureSha256: string;
  supportingDocuments: Array<{ key: string; path: string; sha256: string; label: string }>;
  /** 제출 순간의 신분증·얼굴 사진 — 봉인은 이 해시로만 검증한다(제출 뒤 바뀐 사진은 봉인하지 않는다) */
  identityAssets?: Array<{ key: 'id_card' | 'selfie'; path: string; sha256: string }>;
  submittedAt: number;
};

export type EsignAdminState = {
  session: EsignSession | null;
  publicUrl: string;
  stage: '작성' | '발송 전' | '고객 작성 중' | '검토 대기' | '완료';
  attention: string[];
  events: Array<{ type: string; at: number; by: string; detail: Record<string, unknown> }>;
  review?: {
    submittedAt: number;
    customerName: string;
    customerPhone: string;
    customerBirth: string;
    customerAddress: string;
    driverLicenseNo: string;
    signerName: string;
    signerRole: string;
    emergency: string;
    cms: string;
    assets: Array<{ key: string; label: string; name: string; contentType: string; url: string }>;
  };
};
