/**
 * **공용 신원 여정 시뮬레이션** — 계약(freepass-data `docs/IDENTITY-AND-ACCESS.md`)을 실제로 걸어 본다.
 *
 *   가입 → 메일 인증 전 → 인증 후 PENDING → 승인(grant 없음) → grant 부여 → 취소
 *
 * ★에뮬레이터에서만 돈다. 운영 자격증명을 쓰지 않는다.
 *   firebase emulators:exec --only auth,firestore --project <p> "npm run test:identity-journey"
 *
 * 이 검사가 있는 까닭: 세션이 Firebase 발급으로 바뀌면서 런타임 검사가 «로그인한 뒤»를 못 걷게 됐다.
 * 그 빈자리를 여기서 메운다.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'freepasserp5';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const ACCOUNTS = 'identity_accounts';
const APP_GRANT = 'freepass-admin';

process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
/* 에뮬레이터라도 firebase-admin 은 진짜 꼴의 키를 요구한다.
   일회용을 그 자리에서 만든다 — 이것으로 구글에 서명하는 일은 없다(모두 에뮬레이터로 간다). */
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const SERVICE_ACCOUNT = { project_id: PROJECT, client_email: `sim@${PROJECT}.iam.gserviceaccount.com`, private_key: PEM };
process.env.IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(SERVICE_ACCOUNT);

const { resolveSession, sessionCookieFrom, forgetAuthority } = await import('../src/server/identity.js');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore } = await import('firebase-admin/firestore');
const { cert, getApps, initializeApp } = await import('firebase-admin/app');

const app = getApps().find((a) => a.name === 'sim')
  ?? initializeApp({ credential: cert({ projectId: PROJECT, clientEmail: SERVICE_ACCOUNT.client_email, privateKey: PEM }), projectId: PROJECT }, 'sim');
const auth = getAuth(app);
const db = getFirestore(app);

const EMAIL = 'journey@teamjpk.com';

/** 에뮬레이터 REST 로 비밀번호 로그인 → ID 토큰. 브라우저가 하는 일과 같다 */
async function idTokenOf(email: string, password: string): Promise<string> {
  const r = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = await r.json() as { idToken?: string; error?: { message?: string } };
  assert.ok(j.idToken, `sign-in failed: ${j.error?.message}`);
  return j.idToken;
}

const cookieFor = async (email: string) => sessionCookieFrom(await idTokenOf(email, 'journey-pass-1'));
const denialOf = async (cookie: string) => {
  const r = await resolveSession(cookie);
  return 'denied' in r ? r.denied : null;
};

test('신원 여정 — 가입부터 취소까지', async (t) => {
  const user = await auth.createUser({ email: EMAIL, password: 'journey-pass-1', emailVerified: false });
  t.after(async () => {
    await auth.deleteUser(user.uid).catch(() => {});
    await db.collection(ACCOUNTS).doc(EMAIL).delete().catch(() => {});
  });

  await t.test('① 메일 인증 전에는 들어오지 못하고, 까닭이 «승인»이 아니다', async () => {
    /* ★이 둘을 합치면 메일만 누르면 될 사람이 오지 않을 승인을 기다린다 */
    assert.equal(await denialOf(await cookieFor(EMAIL)), 'EMAIL_UNVERIFIED');
  });

  await auth.updateUser(user.uid, { emailVerified: true });

  await t.test('② 인증했어도 권한 기록이 없으면 거절한다', async () => {
    forgetAuthority(user.uid);
    assert.equal(await denialOf(await cookieFor(EMAIL)), 'NOT_APPROVED');
  });

  await t.test('③ PENDING 은 거절한다', async () => {
    await db.collection(ACCOUNTS).doc(EMAIL).set({ id: EMAIL, status: 'PENDING', grants: [], createdAt: new Date().toISOString() });
    forgetAuthority(user.uid);
    assert.equal(await denialOf(await cookieFor(EMAIL)), 'NOT_APPROVED');
  });

  await t.test('④ ★APPROVED 라도 이 앱 grant 가 없으면 거절한다 — 승인은 「진짜 동료」일 뿐이다', async () => {
    await db.collection(ACCOUNTS).doc(EMAIL).update({ status: 'APPROVED', grants: ['audit-dashboard'] });
    forgetAuthority(user.uid);
    assert.equal(await denialOf(await cookieFor(EMAIL)), 'NOT_APPROVED');
  });

  await t.test('⑤ grant 를 받으면 들어온다', async () => {
    await db.collection(ACCOUNTS).doc(EMAIL).update({ grants: ['audit-dashboard', APP_GRANT] });
    forgetAuthority(user.uid);
    const r = await resolveSession(await cookieFor(EMAIL));
    assert.ok('who' in r, JSON.stringify(r));
    assert.equal(r.who.id, EMAIL);
  });

  await t.test('⑥ grant 를 거두면 다시 막힌다', async () => {
    await db.collection(ACCOUNTS).doc(EMAIL).update({ grants: ['audit-dashboard'] });
    forgetAuthority(user.uid);
    assert.equal(await denialOf(await cookieFor(EMAIL)), 'NOT_APPROVED');
  });

  await t.test('⑦ 계정을 지우면 쿠키가 남아 있어도 막힌다', async () => {
    await db.collection(ACCOUNTS).doc(EMAIL).update({ grants: ['audit-dashboard', APP_GRANT] });
    forgetAuthority(user.uid);
    const cookie = await cookieFor(EMAIL);
    assert.equal(await denialOf(cookie), null, '지우기 전엔 들어와진다');
    await auth.deleteUser(user.uid);
    forgetAuthority(user.uid);
    assert.equal(await denialOf(cookie), 'NO_SESSION');
  });

  /* ⚠ 여기서 못 걸어보는 것 — 거짓 통과를 만들지 않기 위해 적어 둔다.
     ① `revokeRefreshTokens` 뒤의 세션쿠키 거부: Auth 에뮬레이터가 세션쿠키 취소를 구현하지 않는다
        (실측 2026-09-27 — 취소 뒤에도 그대로 열렸다). 우리 코드는 `checkRevoked` 를 켜고 있으며
        그 사실은 freepass-data-boundary 테스트가 고정한다. 실제 프로젝트에서만 확인된다.
     ② 권한 저장소에 «못 닿을 때» fail-closed: Firestore 클라이언트가 첫 호출에 호스트를 물어
        도중에 env 를 바꿔도 안 먹는다. 그걸 모르고 넣었다가 «통과»하는 것을 보고 걷었다 —
        코드의 `catch { who = null }` 는 boundary 테스트가 고정한다. */
});
