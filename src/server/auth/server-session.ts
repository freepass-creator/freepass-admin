import 'server-only';

import { cookies } from 'next/headers';
import type { Capability } from '@/domain/access/access-control';
import { authorizeSession } from './authorize';
import { firebaseSessionVerifier, firestoreStaffAccounts } from './firebase-adapters';

export const SESSION_COOKIE_NAME = '__Host-freepass_session';

export async function requireServerCapability(capability: Capability) {
  const cookieStore = await cookies();
  return authorizeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value, capability, {
    sessionVerifier: firebaseSessionVerifier,
    staffAccounts: firestoreStaffAccounts,
  });
}
