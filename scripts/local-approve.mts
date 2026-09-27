/**
 * **로컬에서 나를 승인한다** — 에뮬레이터 전용.
 *
 *   npm run local:approve -- name@teamjpk.com
 *
 * 로컬에는 메일이 오지 않고 마스터 승인 화면도 없다(승인은 프리패스 데이터가 한다).
 * 그래서 로컬에서 로그인까지 걸어 보려면 둘을 손으로 해줘야 한다 — 이 스크립트가 그 둘이다.
 *   ① Firebase Auth 의 그 계정을 «메일 인증됨» 으로 바꾼다
 *   ② `identity_accounts` 에 `APPROVED` 기록을 만든다
 *
 * ★에뮬레이터에만 쓴다. 운영 자격증명을 읽지 않으며, 에뮬레이터 호스트가 없으면 아무것도 하지 않는다.
 */
import { generateKeyPairSync } from 'node:crypto';

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email.includes('@')) {
  console.error('쓰는 법: npm run local:approve -- name@teamjpk.com');
  process.exit(1);
}

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const STORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const PROJECT = process.env.IDENTITY_FIREBASE_PROJECT_ID ?? 'freepasserp5';

/* ★운영을 건드리지 않는다는 보장 — 에뮬레이터로 못 가면 그냥 멈춘다 */
for (const [what, host] of [['Auth', AUTH], ['Firestore', STORE]] as const) {
  const ok = await fetch(`http://${host}/`).then(() => true).catch(() => false);
  if (!ok) {
    console.error(`${what} 에뮬레이터가 ${host} 에 없습니다. 먼저 켜세요:`);
    console.error('  npx firebase emulators:start --only auth,firestore --project ' + PROJECT);
    process.exit(1);
  }
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;
process.env.FIRESTORE_EMULATOR_HOST = STORE;

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { cert, initializeApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore } = await import('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({ projectId: PROJECT, clientEmail: `local@${PROJECT}.iam.gserviceaccount.com`, privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string }),
  projectId: PROJECT,
}, 'local-approve');

const user = await getAuth(app).getUserByEmail(email).catch(() => null);
if (!user) {
  console.error(`${email} 계정이 없습니다 — 먼저 /login 에서 「계정 만들기」로 가입하세요.`);
  process.exit(1);
}
await getAuth(app).updateUser(user.uid, { emailVerified: true });

const now = new Date().toISOString();
await getFirestore(app).collection('identity_accounts').doc(email).set({
  id: email,
  status: 'APPROVED',
  role: 'MASTER',
  grants: ['audit-dashboard', 'freepass-admin'],
  name: user.displayName ?? email.split('@')[0],
  createdAt: now,
  approvedAt: now,
  approvedBy: 'LOCAL_EMULATOR',
}, { merge: true });

console.log(`${email} — 메일 인증됨 · APPROVED. 이제 /login 에서 로그인하면 들어갑니다.`);
