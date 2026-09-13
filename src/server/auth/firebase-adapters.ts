import 'server-only';

import { getFreePassFirebaseAuth, getFreePassFirestore } from '@/server/firebase/admin';
import type { SessionVerifier, StaffAccountReader, StaffAccountRecord } from './types';

export const firebaseSessionVerifier: SessionVerifier = {
  async verifySessionCookie(sessionCookie) {
    const claims = await getFreePassFirebaseAuth().verifySessionCookie(sessionCookie, true);
    return { uid: claims.uid };
  },
};

export const firestoreStaffAccounts: StaffAccountReader = {
  async findByUid(uid): Promise<StaffAccountRecord | null> {
    const snapshot = await getFreePassFirestore().collection('staffAccounts').doc(uid).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    return { role: data?.role, status: data?.status };
  },
};
