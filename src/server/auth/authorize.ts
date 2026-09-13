import { can, isStaffRole, type Capability } from '@/domain/access/access-control';
import { AccessError } from './errors';
import type { Principal, SessionVerifier, StaffAccountReader } from './types';

export function authorizePrincipal(
  principal: Principal | null,
  capability: Capability,
): Principal {
  if (!principal) throw new AccessError('UNAUTHENTICATED', 401);
  if (!can(principal.role, capability)) throw new AccessError('ROLE_NOT_ALLOWED', 403);
  return principal;
}

export async function authorizeSession(
  sessionCookie: string | undefined,
  capability: Capability,
  dependencies: {
    sessionVerifier: SessionVerifier;
    staffAccounts: StaffAccountReader;
  },
): Promise<Principal> {
  if (!sessionCookie) throw new AccessError('UNAUTHENTICATED', 401);

  let uid: string;
  try {
    ({ uid } = await dependencies.sessionVerifier.verifySessionCookie(sessionCookie));
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError('UNAUTHENTICATED', 401);
  }

  const account = await dependencies.staffAccounts.findByUid(uid);
  if (!account || !isStaffRole(account.role)) {
    throw new AccessError('ROLE_NOT_ALLOWED', 403);
  }
  if (account.status !== 'ACTIVE') {
    throw new AccessError('ACCOUNT_DISABLED', 401);
  }

  return authorizePrincipal({ uid, role: account.role, status: 'ACTIVE' }, capability);
}
