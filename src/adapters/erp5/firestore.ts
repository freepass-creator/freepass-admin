import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { DEMO_PROJECT, demoFirestore, demoMode } from './demo';
import { isLocalFirestoreEmulatorHost } from '../../shared/erp5-write-approval';
import {
  adminWorkflowTransportReady,
  freepassDataWorkflowFirestore,
} from '../freepass-data/admin-workflow-firestore';

export { demoMode } from './demo';

/**
 * FreePass Admin operational data transport.
 *
 * Production/business-data access authority belongs to FreePass Data. Admin does not
 * initialize a Firebase business-data credential. The only direct Firestore path kept
 * here is the isolated local emulator used by integration tests.
 */
export const ERP5_PROJECT_ID = 'freepasserp5';
const APP_NAME = 'freepass-admin-erp5-emulator';

let emulatorApp: App | null = null;

function localEmulatorHost() {
  const host = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  if (!host) return null;
  if (!isLocalFirestoreEmulatorHost(host)) {
    throw new Error('원격 FIRESTORE_EMULATOR_HOST는 허용하지 않습니다');
  }
  return host;
}

function ensureEmulatorApp(): App {
  if (!localEmulatorHost()) {
    throw new Error('운영 Firebase Storage/Firestore 직접 접근은 금지됩니다 — FreePass Data를 사용합니다.');
  }
  emulatorApp ??= getApps().find((app) => app.name === APP_NAME) ?? null;
  emulatorApp ??= initializeApp({ projectId: ERP5_PROJECT_ID }, APP_NAME);
  return emulatorApp;
}

/**
 * Kept only for emulator-backed e-sign integration tests. Production e-sign storage must
 * move through a FreePass Data storage contract before ESIGN_ENABLED can be enabled.
 */
export function erp5App(): App {
  if (demoMode()) throw new Error('가상 데이터 모드(FPA_DEMO=on)에서는 ERP5 Storage 를 쓰지 않습니다');
  return ensureEmulatorApp();
}

/**
 * Repository-compatible Firestore facade.
 * - demo: in-memory development fixture
 * - local emulator: direct isolated Firestore for integration tests only
 * - all other runtimes: authenticated FreePass Data workflow transport
 */
export function erp5(): Firestore {
  if (demoMode()) return demoFirestore();
  if (localEmulatorHost()) return getFirestore(ensureEmulatorApp());
  if (!adminWorkflowTransportReady()) {
    throw new Error(
      'FreePass Data workflow 연결이 없습니다 — FREEPASS_DATA_BASE_URL과 '
      + 'FREEPASS_DATA_ADMIN_CATALOG_TOKEN을 설정해야 합니다.',
    );
  }
  return freepassDataWorkflowFirestore() as unknown as Firestore;
}

/** 화면·상태줄에서 실제 데이터 접근 경계를 확인한다. */
export function erp5Ready(): { ok: true; project: string } | { ok: false; project: string; why: string } {
  if (demoMode()) return { ok: true, project: DEMO_PROJECT };
  try {
    if (localEmulatorHost()) {
      erp5();
      return { ok: true, project: `${ERP5_PROJECT_ID}:emulator` };
    }
    if (!adminWorkflowTransportReady()) {
      return { ok: false, project: 'freepass-data', why: 'FreePass Data workflow transport is not configured' };
    }
    return { ok: true, project: 'freepass-data' };
  } catch (error) {
    return { ok: false, project: 'freepass-data', why: (error as Error).message };
  }
}
