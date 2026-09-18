import type { EsignPrivateSubmission, EsignSession } from '../../domain/esign/types';

export interface EsignRepository {
  getContract(id: string): Promise<Record<string, unknown> | null>;
  createContract(id: string, data: Record<string, unknown>): Promise<void>;
  updateContract(id: string, patch: Record<string, unknown>): Promise<void>;
  getCurrentSession(contractId: string): Promise<EsignSession | null>;
  getSession(id: string): Promise<EsignSession | null>;
  findSessionByTokenHash(hash: string): Promise<EsignSession | null>;
  createSession(session: EsignSession, publicUrl: string): Promise<void>;
  updateSession(id: string, patch: Partial<EsignSession>): Promise<void>;
  transitionSession(id: string, allowed: EsignSession['status'][], patch: Partial<EsignSession>): Promise<boolean>;
  getPrivate(sessionId: string): Promise<(EsignPrivateSubmission & Record<string, unknown>) | null>;
  putPrivate(sessionId: string, data: Record<string, unknown>): Promise<void>;
  appendEvent(contractId: string, sessionId: string, type: string, by: string, detail?: Record<string, unknown>): Promise<void>;
}

export interface EsignAssetStore {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<{ path: string; sha256: string; size: number }>;
  get(path: string, expectedSha256?: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}
