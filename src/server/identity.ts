/**
 * **신원과 권한 — 프리패스 공용 계약** (freepass-data `docs/IDENTITY-AND-ACCESS.md`, 2026-09-27)
 *
 *   ┌ 비밀번호·재설정·세션취소 ─ Firebase Authentication (프리패스 데이터 Firebase 프로젝트)
 *   └ 승인·역할·앱별 grant ──── 프리패스 데이터 Firestore `identity_accounts`
 *
 * 계약이 이 앱에 지우는 의무는 넷이다.
 *   ① 비밀번호를 저장하지 않는다 · 자기 세션 토큰을 만들지 않는다 · 자기 허용목록을 두지 않는다.
 *   ② ID 토큰은 «서버에서» 검증한다. 브라우저에서만 본 것은 검증이 아니다.
 *   ③ 검증 뒤 권한을 프리패스 데이터에서 풀고 **fail-closed** 한다 —
 *      모르는 계정 · 승인 안 된 계정 · grant 없음 · 권한 저장소에 못 닿음, 넷 다 «거절»이다.
 *   ④ 푼 권한은 최대 5분만 들고 있는다. 취소가 그 안에 걸려야 한다.
 *
 * ── 세션을 쿠키로 두는 까닭
 *   감사 대시보드는 SPA 라 요청마다 ID 토큰을 붙일 수 있다. 어드민은 서버가 쪽을 그리므로 그 길이 없다.
 *   그래서 «우리가 만든 토큰»이 아니라 **Firebase 가 발급하는 세션 쿠키**(`createSessionCookie`)를 쓴다 —
 *   발급도 취소도 Firebase 쪽이라 ① 을 깨지 않는다. 검증할 때 `checkRevoked` 를 켜서 취소를 즉시 받는다.
 *   ★계약 §6 의 「앱 부류별 세션 길이」는 아직 열려 있다. 여기 값(5일)은 어드민의 제안이며,
 *     감사 대시보드 이전이 운영에서 돈 뒤 공용 계약에 맞춘다.
 *
 * ── 이 파일이 만지는 것
 *   Firebase Auth 와 `identity_accounts` 뿐이다. 업무 원장(settlement_rows · contract · products)은
 *   건드리지 않는다. 그 경계는 freepass-data-boundary 테스트가 지킨다.
 */
import { cert, getApps, initializeApp, type App, type Credential } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { IdentityPoolClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

/** ★프리패스 데이터와 같은 이름이어야 한다 — 한쪽만 바꾸면 권한이 갈라진다 */
const ACCOUNTS = 'identity_accounts';
/** 이 앱의 grant 이름. `APPROVED` 라도 이 grant 가 없으면 못 들어온다 */
export const APP_GRANT = 'freepass-admin';
export const SESSION_MS = 5 * 24 * 3600_000;
/** 계약 ④ — 최대 5분 */
const AUTHORITY_TTL_MS = 5 * 60_000;

export interface Identity { uid: string; id: string; name: string; role: 'MASTER' | 'MEMBER' }

/** 브라우저가 쓰는 Firebase 웹 설정 — 비밀이 아니다(공개 배포물에 실린다) */
export interface WebConfig { apiKey: string; authDomain: string; projectId: string; authEmulatorHost?: string }
export function webConfig(): WebConfig | null {
  const apiKey = process.env.IDENTITY_FIREBASE_WEB_API_KEY?.trim();
  const authDomain = process.env.IDENTITY_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.IDENTITY_FIREBASE_PROJECT_ID?.trim();
  if (!apiKey || !authDomain || !projectId) return null;
  /* 개발·검증 전용 — 이것이 없으면 에뮬레이터로 전체 흐름을 돌려볼 길이 없다.
     ★운영에 들어가면 사고다 — deploy-env 가 error 로 막는다. */
  const authEmulatorHost = process.env.IDENTITY_FIREBASE_AUTH_EMULATOR_HOST?.trim();
  return { apiKey, authDomain, projectId, ...(authEmulatorHost ? { authEmulatorHost } : {}) };
}
/** Dedicated trust: no ERP credential, default ADC or arbitrary token endpoint fallback. */
export const IDENTITY_WIF_AUDIENCE = '//iam.googleapis.com/projects/110304297079/locations/global/workloadIdentityPools/vercel/providers/freepass-admin-identity-prod';
export const IDENTITY_SERVICE_ACCOUNT = 'freepass-admin-identity@freepasserp5.iam.gserviceaccount.com';
export function identityFederationConfig(env: Record<string, string | undefined> = process.env) {
  const audience = env.IDENTITY_GCP_WIF_AUDIENCE?.trim();
  const email = env.IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!audience && !email) return null;
  if (audience !== IDENTITY_WIF_AUDIENCE || email !== IDENTITY_SERVICE_ACCOUNT
    || env.IDENTITY_FIREBASE_PROJECT_ID?.trim() !== 'freepasserp5'
    || env.VERCEL_ENV !== 'production' || env.IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    throw new Error('IDENTITY_FEDERATION_CONFIG_INVALID');
  }
  return { audience, email, projectId: 'freepasserp5' };
}
export const identityReady = () => {
  try { return !!webConfig() && (!!identityFederationConfig() || !!serviceAccountRaw()); }
  catch { return false; }
};

let federatedClient: IdentityPoolClient | null = null;
function identityClient(): IdentityPoolClient {
  if (federatedClient) return federatedClient;
  const config = identityFederationConfig();
  if (!config) throw new Error('IDENTITY_FEDERATION_NOT_CONFIGURED');
  return (federatedClient = new IdentityPoolClient({
    audience: config.audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'
      + encodeURIComponent(config.email) + ':generateAccessToken',
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    transporterOptions: { timeout: 5_000, retry: false },
    // Read fresh request context on refresh; do not freeze a deployment-time OIDC token.
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
  }));
}

export const identityFederatedCredential: Credential = {
  async getAccessToken() {
    const client = identityClient();
    const { token } = await client.getAccessToken();
    const expires = Math.floor(((client.credentials.expiry_date ?? 0) - Date.now()) / 1000);
    if (!token || expires <= 0) throw new Error('IDENTITY_ACCESS_TOKEN_UNAVAILABLE');
    return { access_token: token, expires_in: expires };
  },
};

const serviceAccountRaw = () =>
  process.env.IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

const IDENTITY_APP = 'freepass-admin-identity';
let cachedApp: App | null = null;
/** ★신원 전용 app — 업무 원장 게이트웨이와 섞지 않는다 */
function identityApp(): App {
  if (cachedApp) return cachedApp;
  const hit = getApps().find((a) => a.name === IDENTITY_APP);
  if (hit) return (cachedApp = hit);
  const federation = identityFederationConfig();
  if (federation) {
    return (cachedApp = initializeApp({ credential: identityFederatedCredential, projectId: federation.projectId }, IDENTITY_APP));
  }
  const raw = serviceAccountRaw();
  if (!raw) throw new Error('신원 자격증명이 없습니다(IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON)');
  const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  return (cachedApp = initializeApp({
    credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key.replace(/\\n/g, '\n') }),
    projectId: sa.project_id,
  }, IDENTITY_APP));
}

/** 브라우저가 보낸 ID 토큰 → Firebase 세션 쿠키. ★토큰을 «우리가» 만들지 않는다 */
export async function sessionCookieFrom(idToken: string): Promise<string> {
  return getAuth(identityApp()).createSessionCookie(idToken, { expiresIn: SESSION_MS });
}

/** 로그아웃 — 그 사람의 세션을 전부 끊는다(다른 기기 포함) */
export async function revokeSessions(cookie: string): Promise<void> {
  try {
    const d = await getAuth(identityApp()).verifySessionCookie(cookie);
    await getAuth(identityApp()).revokeRefreshTokens(d.sub);
  } catch { /* 이미 끊겼다 */ }
}

interface Authority { status?: string; role?: string; grants?: unknown; name?: string }
const cache = new Map<string, { at: number; who: Identity | null }>();

/** Firebase Admin Firestore rejects custom credentials. Use Google's document GET for WIF.
 * The sole path is the shared account collection, with no list/write/business-data operation.
 */
export async function identityAccountFromFederation(id: string): Promise<Authority | null> {
  const config = identityFederationConfig();
  if (!config) throw new Error('IDENTITY_FEDERATION_NOT_CONFIGURED');
  const { access_token } = await identityFederatedCredential.getAccessToken();
  const response = await fetch('https://firestore.googleapis.com/v1/projects/' + config.projectId
    + '/databases/(default)/documents/' + ACCOUNTS + '/' + encodeURIComponent(id), {
    headers: { authorization: 'Bearer ' + access_token },
    cache: 'no-store', signal: AbortSignal.timeout(5_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('IDENTITY_ACCOUNT_HTTP_' + response.status);
  const body = await response.json() as { fields?: Record<string, { stringValue?: unknown }> };
  const field = (key: string) => typeof body.fields?.[key]?.stringValue === 'string'
    ? body.fields[key].stringValue as string : undefined;
  return { status: field('status'), role: field('role'), name: field('name') };
}

/**
 * 계약 ③ — 권한을 풀고 fail-closed. 못 읽었다고 열어 주지 않는다.
 *
 * ★★**지금은 `APPROVED` 만 본다. grant 는 보지 않는다.** — 대표 2026-09-27 「승인만 받으면 들어오게」
 *   계약 §4 는 「`APPROVED` 여도 그 앱 grant 가 없으면 거절」이지만, 프리패스 데이터의 `decisionRecord` 가
 *   승인할 때 `grants` 를 `['audit-dashboard']` 로 «통째로 덮어쓴다». 그래서 `freepass-admin` 을
 *   넣어 주는 길이 없고, 손으로 넣어도 다음 승인에 지워진다(실측 2026-09-27 — 시뮬레이션으로 확인).
 *   그 상태로 계약을 지키면 «대표를 포함해 아무도» 못 들어온다.
 *
 *   ⚠ 그래서 이 문은 지금 「진짜 동료인가」까지만 묻는다. 감사 대시보드만 쓰라고 승인한 사람도
 *     미수·계약·정산을 다 본다. 그 차이를 받아들인 결정이다.
 *   ⚠ **되돌릴 자리는 아래 한 줄이다.** 프리패스 데이터가 grants 를 앱별로 «병합»하도록 고치면
 *     `&& grants.includes(APP_GRANT)` 를 되살린다. boundary 테스트가 이 상태를 고정하고 있어서
 *     말없이 바뀌지 않는다.
 */
async function authorityOf(uid: string, email: string): Promise<Identity | null> {
  const id = email.trim().toLowerCase();
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < AUTHORITY_TTL_MS) return hit.who;
  let who: Identity | null = null;
  try {
    let a: Authority | null;
    if (identityFederationConfig()) a = await identityAccountFromFederation(id);
    else {
      const snap = await getFirestore(identityApp()).collection(ACCOUNTS).doc(id).get();
      a = (snap.exists ? snap.data() : null) as Authority | null;
    }
    if (a?.status === 'APPROVED') {
      who = { uid, id, name: String(a.name ?? id.split('@')[0]), role: a.role === 'MASTER' ? 'MASTER' : 'MEMBER' };
    }
  } catch { who = null; }
  cache.set(uid, { at: Date.now(), who });
  return who;
}

/** 방금 승인·취소된 사람을 5분 캐시에 묶어 두지 않는다 */
export const forgetAuthority = (uid: string) => cache.delete(uid);

/**
 * 세션 쿠키 → 들어와도 되는 사람. 계약 ②③ 이 여기서 한 번에 걸린다.
 * ★`checkRevoked` 를 켠다 — 비밀번호를 바꾸거나 강제 로그아웃한 세션이 남아 돌지 않게.
 * ★★거절한 «까닭»을 가른다. 메일 인증을 안 한 사람에게 「승인 대기」라고 하면
 *   오지 않을 승인을 기다리며 영영 막힌다. 화면에 나가는 문구는 이 둘만 가르고, 그 밖은 뭉뚱그린다.
 */
export type Denial = 'NO_SESSION' | 'EMAIL_UNVERIFIED' | 'NOT_APPROVED';

export async function resolveSession(cookie: string | undefined): Promise<{ who: Identity } | { denied: Denial }> {
  if (!cookie) return { denied: 'NO_SESSION' };
  let uid: string, email: string, verified: boolean;
  try {
    const d = await getAuth(identityApp()).verifySessionCookie(cookie, true);
    uid = d.uid; email = String(d.email ?? ''); verified = d.email_verified === true;
  } catch { return { denied: 'NO_SESSION' }; }
  if (!email) return { denied: 'NO_SESSION' };
  if (!verified) return { denied: 'EMAIL_UNVERIFIED' };   /* 메일 확인 전에는 들이지 않는다 */
  const who = await authorityOf(uid, email);
  return who ? { who } : { denied: 'NOT_APPROVED' };
}

export async function identityFromCookie(cookie: string | undefined): Promise<Identity | null> {
  const r = await resolveSession(cookie);
  return 'who' in r ? r.who : null;
}
