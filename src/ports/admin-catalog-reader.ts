import type { CanonicalProduct } from '../domain/product/types';

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
  servedBy: 'LEGACY_ERP5_BRIDGE' | 'FREEPASS_DATA';
  cutoverAuthorized: boolean;
  holdReasons: string[];
  legacy?: {
    project: string;
    readAt: string;
    docs: number;
    mapped: number;
    warnings: number;
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
