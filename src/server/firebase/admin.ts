import 'server-only';

import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { AccessError } from '@/server/auth/errors';

const APP_NAME = 'freepasserp-v1';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AccessError('AUTH_NOT_CONFIGURED', 503);
  return value;
}

export function getFreePassFirebaseApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return getApp(APP_NAME);

  const projectId = required('FREEPASS_FIREBASE_PROJECT_ID');
  const clientEmail = required('FREEPASS_FIREBASE_CLIENT_EMAIL');
  const privateKey = required('FREEPASS_FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  return initializeApp({
    projectId,
    credential: cert({ projectId, clientEmail, privateKey }),
  }, APP_NAME);
}

export function getFreePassFirebaseAuth() {
  return getAuth(getFreePassFirebaseApp());
}

export function getFreePassFirestore() {
  return getFirestore(getFreePassFirebaseApp());
}
