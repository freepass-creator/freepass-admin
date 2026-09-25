import type { ContractHandoffSource, EsignPrivateSubmission, EsignSession } from '../../domain/esign/types';

export interface EsignRepository {
  getContract(id: string): Promise<Record<string, unknown> | null>;
  getIntakeContractSource(intakeId: string): Promise<ContractHandoffSource | null>;
  createContract(id: string, data: Record<string, unknown>): Promise<void>;
  createContractFromIntake(source: ContractHandoffSource, id: string, data: Record<string, unknown>): Promise<{ created: boolean; contract: Record<string, unknown> }>;
  updateContract(id: string, patch: Record<string, unknown>): Promise<void>;
  getCurrentSession(contractId: string): Promise<EsignSession | null>;
  getSession(id: string): Promise<EsignSession | null>;
  findSessionByTokenHash(hash: string): Promise<EsignSession | null>;
  issueSession(
    session: EsignSession,
    publicUrl: string,
    contractPatch: Record<string, unknown>,
    actor: string,
  ): Promise<void>;
  updateSession(id: string, patch: Partial<EsignSession>): Promise<void>;
  transitionSession(id: string, allowed: EsignSession['status'][], patch: Partial<EsignSession>): Promise<boolean>;
  revokeSession(
    sessionId: string,
    contractId: string,
    actor: string,
  ): Promise<{ revoked: boolean; session: EsignSession }>;
  cancelContract(
    contractId: string,
    reason: string,
    actor: string,
  ): Promise<{ cancelled: boolean; session: EsignSession | null; signedDocumentPreserved: boolean }>;
  finalizeSigned(
    sessionId: string,
    finalizationId: string,
    sessionPatch: Partial<EsignSession>,
    contractPatch: Record<string, unknown>,
    actor: string,
    detail: Record<string, unknown>,
  ): Promise<{ finalized: boolean; session: EsignSession }>;
  getPrivate(sessionId: string): Promise<(EsignPrivateSubmission & Record<string, unknown>) | null>;
  putPrivate(sessionId: string, data: Record<string, unknown>): Promise<void>;
  appendEvent(contractId: string, sessionId: string, type: string, by: string, detail?: Record<string, unknown>): Promise<void>;
  listEvents(contractId: string): Promise<Array<{ type: string; at: number; by: string; detail: Record<string, unknown> }>>;
  /**
   * 승인 claim 을 «내 것일 때만» 푼다(approving → pending_review). 다른 finalizationId 의 claim 이면 건드리지 않는다.
   * ★상태만 보고 풀면, 오래 걸려 늦게 실패한 요청이 그 사이 다른 관리자가 잡은 claim 을 풀어 버린다.
   */
  releaseFinalizationClaim(sessionId: string, finalizationId: string): Promise<boolean>;
}

export interface EsignFinalDocumentRenderer {
  render(input: {
    snapshot: EsignSession['snapshot'];
    submission: EsignPrivateSubmission;
    signatureBytes: Uint8Array;
    sealHash: string;
  }): Promise<{ bytes: Uint8Array; contentType: 'application/pdf' }>;
}

export interface EsignAssetStore {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<{ path: string; sha256: string; size: number }>;
  get(path: string, expectedSha256?: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}
