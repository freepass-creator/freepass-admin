import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDeployEnv } from './deploy-env';
import { tokenSha256 } from '../shared/freepass-data-admin-cutover';

const sa = JSON.stringify({ project_id: 'freepasserp5', client_email: 'x@freepasserp5.iam.gserviceaccount.com', private_key: 'k' });
const good = {
  /* 로그인 — 프리패스 공용 신원. 웹 설정 셋은 비밀이 아니다(공개 배포물에 실린다) */
  IDENTITY_FIREBASE_WEB_API_KEY: 'AIzaSyTestTestTestTestTestTestTest',
  IDENTITY_FIREBASE_AUTH_DOMAIN: 'freepasserp5.firebaseapp.com',
  IDENTITY_FIREBASE_PROJECT_ID: 'freepasserp5',
  IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON: sa,
  ERP5_FIREBASE_SERVICE_ACCOUNT_JSON: sa,
  ERP5_WRITE: 'off',
  APP_BASE_URL: 'https://freepass-admin.vercel.app',
  PUBLIC_BASE_URL: 'https://freepass-admin.vercel.app',
  CLAIM_LINK_BASE: 'https://freepass-admin.vercel.app/',
};
const writeApproval = JSON.stringify({
  projectId: 'freepasserp5',
  iamVerified: true,
  iamRef: 'iam-check-20260926',
  backupRestoreVerified: true,
  backupRestoreRef: 'restore-drill-20260926',
  serviceAccountEmail: 'x@freepasserp5.iam.gserviceaccount.com',
  productionOrigin: 'https://freepass-admin.vercel.app',
  approvalRef: 'ops-20260926',
  approvedAt: '2026-09-26T06:30:00.000Z',
  validUntil: '2026-10-03T06:30:00.000Z',
});
const errors = (env: Record<string, string | undefined>) => checkDeployEnv(env).filter((f) => f.level === 'error').map((f) => f.key);

test('complete first-deploy env has no errors and never echoes secret values', () => {
  const findings = checkDeployEnv(good);
  assert.deepEqual(findings.filter((f) => f.level === 'error'), []);
  const text = JSON.stringify(findings);
  assert.equal(text.includes('a'.repeat(48)), false);
  assert.equal(text.includes('"k"'), false);
});

test('missing login and data credentials are errors', () => {
  assert.deepEqual(errors({}).sort(), [
    'ERP5_FIREBASE_SERVICE_ACCOUNT_JSON',
    'IDENTITY_FIREBASE_WEB_API_KEY',
    'IDENTITY_FIREBASE_AUTH_DOMAIN',
    'IDENTITY_FIREBASE_PROJECT_ID',
    'IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON',
  ].sort());
});

test('the retired Google OAuth door is reported as leftover, not as configuration', () => {
  const findings = checkDeployEnv({ ...good, SESSION_SECRET: 'a'.repeat(48), GOOGLE_OAUTH_CLIENT_ID: '123.apps.googleusercontent.com' });
  assert.deepEqual(findings.filter((f) => f.level === 'error'), []);
  const stale = findings.filter((f) => f.level === 'warn').map((f) => f.key);
  assert.ok(stale.includes('SESSION_SECRET') && stale.includes('GOOGLE_OAUTH_CLIENT_ID'), stale.join(','));
});

test('identity falls back to the workflow service account, but says so', () => {
  const { IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON: _drop, ...noIdentityKey } = good;
  const findings = checkDeployEnv(noIdentityKey);
  assert.deepEqual(findings.filter((f) => f.level === 'error'), []);
  assert.ok(findings.some((f) => f.level === 'warn' && f.key === 'IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON'));
});

test('service account from another Firebase project or principal is rejected', () => {
  const other = JSON.stringify({ project_id: 'freepasserp3', client_email: 'x@freepasserp3.iam.gserviceaccount.com', private_key: 'k' });
  const wrongPrincipal = JSON.stringify({ project_id: 'freepasserp5', client_email: 'x@freepasserp3.iam.gserviceaccount.com', private_key: 'k' });
  assert.ok(errors({ ...good, ERP5_FIREBASE_SERVICE_ACCOUNT_JSON: other }).includes('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON'));
  assert.ok(errors({ ...good, ERP5_FIREBASE_SERVICE_ACCOUNT_JSON: wrongPrincipal }).includes('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON'));
  assert.ok(errors({ ...good, ERP5_FIREBASE_SERVICE_ACCOUNT_JSON: '{broken' }).includes('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON'));
});

test('unapproved FreePass Data catalog cutover mode is blocked', () => {
  assert.ok(errors({ ...good, FREEPASS_DATA_ADMIN_CATALOG_READ_MODE: 'SHADOW_READ' }).includes('FREEPASS_DATA_ADMIN_CUTOVER_JSON'));
  assert.ok(errors({ ...good, FREEPASS_DATA_ADMIN_CATALOG_READ_MODE: 'FREEPASS_DATA_READ' }).includes('FREEPASS_DATA_ADMIN_CUTOVER_JSON'));
  assert.equal(errors({ ...good, FREEPASS_DATA_ADMIN_CATALOG_READ_MODE: 'OBSERVE' }).includes('FREEPASS_DATA_ADMIN_CUTOVER_JSON'), false);
});

test('even a well-formed SHADOW_READ receipt cannot outrun the central OBSERVE registry stage', () => {
  const token='s'.repeat(40);
  const cutover=JSON.stringify({
    consumerId:'freepass-admin-catalog',
    fromStage:'OBSERVE',
    targetStage:'SHADOW_READ',
    baseOrigin:'https://data.example.test',
    tokenSha256:tokenSha256(token),
    evidence:{
      contractReady:true,
      authenticationVerified:true,
      legacyReadVerified:true,
      freepassReadVerified:true,
      parityVerified:false,
      fallbackVerified:false,
      productionReadbackVerified:false,
      approvedRelease:null,
    },
    holdReasons:[],
    approvalRef:'cutover-shadow-1',
    approvedAt:'2026-09-26T06:30:00.000Z',
    validUntil:'2026-10-03T06:30:00.000Z',
  });
  const env={
    ...good,
    FREEPASS_DATA_ADMIN_CATALOG_READ_MODE:'SHADOW_READ',
    FREEPASS_DATA_BASE_URL:'https://data.example.test',
    FREEPASS_DATA_ADMIN_CATALOG_TOKEN:token,
    FREEPASS_DATA_ADMIN_CUTOVER_JSON:cutover,
  };
  const findings=checkDeployEnv(env);
  assert.ok(findings.some((x)=>x.key==='FREEPASS_DATA_ADMIN_CUTOVER_JSON'&&x.level==='error'&&/중앙 FreePass Data 레지스트리 단계\(OBSERVE\)/.test(x.message)));
});

test('public addresses must be one https origin without a path', () => {
  assert.ok(errors({ ...good, CLAIM_LINK_BASE: 'http://freepass-admin.vercel.app' }).includes('CLAIM_LINK_BASE'));
  assert.ok(errors({ ...good, PUBLIC_BASE_URL: 'https://other.vercel.app' }).includes('APP_BASE_URL'));
  assert.ok(errors({ ...good, APP_BASE_URL: 'https://freepass-admin.vercel.app/login' }).includes('APP_BASE_URL'));
});

test('emulator and demo settings are blocked in production', () => {
  assert.ok(errors({ ...good, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }).includes('FIRESTORE_EMULATOR_HOST'));
  assert.ok(errors({ ...good, FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199' }).includes('FIREBASE_STORAGE_EMULATOR_HOST'));
  assert.ok(errors({ ...good, FPA_DEMO: 'on' }).includes('FPA_DEMO'));
});

test('ERP5_WRITE=on requires explicit IAM and backup/restore approval evidence', () => {
  assert.ok(errors({ ...good, ERP5_WRITE: 'on' }).includes('ERP5_WRITE_APPROVAL_JSON'));
  const approved = checkDeployEnv({ ...good, ERP5_WRITE: 'on', ERP5_WRITE_APPROVAL_JSON: writeApproval });
  assert.deepEqual(approved.filter((x) => x.level === 'error'), []);
  assert.ok(approved.some((x) => x.key === 'ERP5_WRITE' && x.level === 'ok'));
});

test('e-sign remains a launch-scope warning rather than bypassing data guards', () => {
  const f = checkDeployEnv({ ...good, ESIGN_ENABLED: 'on' });
  assert.deepEqual(f.filter((x) => x.level === 'error'), []);
  assert.ok(f.some((x) => x.key === 'ESIGN_ENABLED' && x.level === 'warn'));
});
