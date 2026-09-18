export type EsignSessionStatus =
  | 'sent' | 'opened' | 'in_progress' | 'pending_review'
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
  approvedAt?: number;
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
  submittedAt: number;
};

export type EsignAdminState = {
  session: EsignSession | null;
  publicUrl: string;
  stage: '작성' | '발송 전' | '고객 작성 중' | '검토 대기' | '완료';
  attention: string[];
};
