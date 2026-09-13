import type { StaffRole } from '@/domain/access/access-control';

export type Principal = {
  uid: string;
  role: StaffRole;
  status: 'ACTIVE';
};

export type VerifiedIdentity = {
  uid: string;
};

export type StaffAccountRecord = {
  role: unknown;
  status: unknown;
};

export interface SessionVerifier {
  verifySessionCookie(sessionCookie: string): Promise<VerifiedIdentity>;
}

export interface StaffAccountReader {
  findByUid(uid: string): Promise<StaffAccountRecord | null>;
}
