import type { CanonicalProduct } from '../domain/product/types';

export const CONTRACT_FEE_LINK_FAILURES = [
  'NO_PLATE', 'NO_ASSET', 'MULTI_ASSET', 'NO_PRODUCT', 'MULTI_PRODUCT',
  'NO_OFFER', 'MULTI_OFFER', 'SUPPLIER_MISMATCH', 'NO_TERM', 'CONDITION_MISMATCH', 'MULTI_TERM',
] as const;
export type ContractFeeLinkFailure = typeof CONTRACT_FEE_LINK_FAILURES[number];
export interface ContractFeeLinkItem {
  key: string;
  plate: string;
  supplierId: string;
  termMonths: number;
  monthlyRent: number;
  deposit?: number;
}
export interface ContractFeeValue {
  status: 'CONFIRMED' | 'UNCONFIRMED';
  state: string;
  amount: { amount: number } | null;
}
/** 비교에 필요한 읽기 투영만 보존한다. 원문 식별자·detail은 화면/CSV에 전달하지 않는다. */
export interface ContractFeeLinkResult {
  key: string;
  status: 'LINKED' | 'FEE_UNCONFIRMED' | 'FAILED';
  failure?: ContractFeeLinkFailure;
  fees?: {
    termKey: string;
    termMonths: number;
    supplierBillingFee: ContractFeeValue;
    channelPayoutFee: ContractFeeValue;
  };
}
export interface ContractFeeLinksClient {
  contractFeeLinks(items: readonly ContractFeeLinkItem[]): Promise<ContractFeeLinkResult[]>;
}
export type ContractFeeLinkReason = ContractFeeLinkFailure | 'NO_SUPPLIER_CODE' | 'INVALID_SUPPLIER_CODE'
  | 'INVALID_KEY' | 'INVALID_TERM' | 'INVALID_CONDITION' | 'FEE_UNCONFIRMED' | 'RECORDED_FEE_UNCONFIRMED' | 'FEE_DIFFERENCE';
export type ContractFeeLinksRead =
  | { status: 'UNAVAILABLE'; code: string }
  | { status: 'READY'; results: ReadonlyMap<string, ContractFeeLinkResult>;
      excluded: ReadonlyMap<string, readonly ContractFeeLinkReason[]> };

export const ADMIN_CATALOG_READ_MODES = [
  'LEGACY_DIRECT',
  'OBSERVE',
  'SHADOW_READ',
  'PARITY_VERIFIED',
  'FREEPASS_DATA_READ',
] as const;

export type AdminCatalogReadMode = typeof ADMIN_CATALOG_READ_MODES[number];

export type AdminCatalogReceipt = {
  /** Shared data authority. The currently served transport may still be a legacy bridge during migration. */
  authority: 'FREEPASS_DATA';
  mode: AdminCatalogReadMode;
  servedBy: 'LEGACY_ERP5_BRIDGE' | 'FREEPASS_DATA_COMPAT_BRIDGE' | 'FREEPASS_DATA';
  cutoverAuthorized: boolean;
  holdReasons: string[];
  cutover?: {
    approvalRef: string;
    fromStage: AdminCatalogReadMode;
    targetStage: AdminCatalogReadMode;
    validUntil: string;
  };
  legacy?: {
    project: string;
    readAt: string;
    docs: number;
    mapped: number;
    warnings: number;
  };
  freepass?: {
    releaseId: string;
    manifestId: string;
    inputDigest: string;
    revision: number;
    dataDigest: string;
    policyParity: 'COMPLETE' | 'INCOMPLETE';
    rows: number;
  };
  shadow?: {
    status: 'MATCH' | 'MISMATCH' | 'HOLD';
    comparedAt: string;
    missingInFreePass: number;
    extraInFreePass: number;
    differentProducts: number;
    reason?: string;
  };
};

export type AdminCatalogListResult = {
  rows: CanonicalProduct[];
  receipt: AdminCatalogReceipt;
};

/**
 * FreePass Admin only knows this Catalog read port.
 * Internal Firestore collection paths are adapter details, never the public data contract.
 */
export interface AdminCatalogReader {
  mode(): AdminCatalogReadMode;
  list(): Promise<AdminCatalogListResult>;
  get(id: string): Promise<CanonicalProduct | null>;
  receipt(): AdminCatalogReceipt;
}
