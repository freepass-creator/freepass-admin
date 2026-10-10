import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDeployEnv } from './deploy-env';
import { tokenSha256 } from '../shared/freepass-data-admin-cutover';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { IDENTITY_SERVICE_ACCOUNT, IDENTITY_WIF_AUDIENCE } from '../shared/identity-federation';

test('actual production build command stops when identity configuration is missing', () => {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  assert.match(scripts.build, /^node --import tsx scripts\/check-deploy-env\.mts --vercel-build && next build$/);
  const env: NodeJS.ProcessEnv = { ...process.env, VERCEL_ENV: 'production' };
  delete env.IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON;
  delete env.IDENTITY_GCP_WIF_AUDIENCE;
  delete env.IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL;
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-deploy-env.mts', '--vercel-build'], { env, encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /ERROR IDENTITY_GCP_WIF_AUDIENCE/);
});

const identitySa = JSON.stringify({
  project_id: 'freepasserp5',
  client_email: 'EMAIL_REDACTED',
  private_key: 'k',
});
const dataToken = 'd'.repeat(40);
const good = {
  IDENTITY_FIREBASE_WEB_API_KEY: 'AIzaSyTestTestTestTestTestTestTest',
  IDENTITY_FIREBASE_AUTH_DOMAIN: 'freepasserp5.firebaseapp.com',
  IDENTITY_FIREBASE_PROJECT_ID: 'freepasserp5',
  IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON: identitySa,
  FREEPASS_DATA_BASE_URL: 'https://data.example.test',
  FREEPASS_DATA_ADMIN_CATALOG_TOKEN: dataToken,
  FREEPASS_DATA_ADMIN_WORKFLOW_WRITE: 'off',
  ERP5_WRITE: 'off',
  APP_BASE_URL: 'https://freepass-admin.vercel.app',
  PUBLIC_BASE_URL: 'https://freepass-admin.vercel.app',
  CLAIM_LINK_BASE: 'https://freepass-admin.vercel.app/',
};
const errors = (env: Record<string, string | undefined>) =>
  checkDeployEnv(env).filter((f) => f.level === 'error').map((f) => f.key);

test('production keyless identity requires exact complete trust; preview, mixed credentials and partial config are rejected', () => {
  const keyless = {
    ...good, VERCEL_ENV: 'production', IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON: undefined,
    IDENTITY_GCP_WIF_AUDIENCE: IDENTITY_WIF_AUDIENCE,
    IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL: IDENTITY_SERVICE_ACCOUNT,
    FREEPASS_DATA_GCP_WIF_AUDIENCE: '//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/pool/providers/provider',
    FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL: 'EMAIL_REDACTED',
  };
  assert.deepEqual(errors(keyless), []);
  assert.ok(errors({ ...good, VERCEL_ENV: 'production' }).includes('IDENTITY_GCP_WIF_AUDIENCE'), 'production never accepts a persistent key instead of federation');
  for (const change of [
    { VERCEL_ENV: 'preview' }, { IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON: identitySa },
    { IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL: '' }, { IDENTITY_FIREBASE_PROJECT_ID: 'other' },
  ]) assert.ok(errors({ ...keyless, ...change }).includes('IDENTITY_GCP_WIF_AUDIENCE'));
});

test('complete first-deploy env has no errors and never echoes secret values', () => {
  const findings = checkDeployEnv(good);
  assert.deepEqual(findings.filter((f) => f.level === 'error'), []);
  const text = JSON.stringify(findings);
  assert.equal(text.includes(dataToken), false);
  assert.equal(text.includes(identitySa), false);
});

test('missing shared identity and FreePass Data credentials are errors', () => {
  assert.deepEqual(errors({}).sort(), [
    'FREEPASS_DATA_BASE_URL',
    'FREEPASS_DATA_ADMIN_CATALOG_TOKEN',
    'IDENTITY_FIREBASE_WEB_API_KEY',
    'IDENTITY_FIREBASE_AUTH_DOMAIN',
    'IDENTITY_FIREBASE_PROJECT_ID',
    'IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON',
  ].sort());
});

test('retired Google OAuth settings are leftovers, not login configuration', () => {
  const findings = checkDeployEnv({
    ...good,
    SESSION_SECRET: 'a'.repeat(48),
    GOOGLE_OAUTH_CLIENT_ID: '123.apps.googleusercontent.com',
    GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
    GOOGLE_WORKSPACE_DOMAIN: 'teamjpk.com',
  });
  assert.deepEqual(findings.filter((f) => f.level === 'error'), []);
  const stale = findings.filter((f) => f.level === 'warn').map((f) => f.key);
  assert.ok(stale.includes('SESSION_SECRET'));
  assert.ok(stale.includes('GOOGLE_OAUTH_CLIENT_ID'));
  assert.ok(stale.includes('GOOGLE_OAUTH_CLIENT_SECRET'));
  assert.ok(stale.includes('GOOGLE_WORKSPACE_DOMAIN'));
});

test('identity credential must match the configured identity Firebase project', () => {
  const other = JSON.stringify({
    project_id: 'freepasserp3',
    client_email: 'EMAIL_REDACTED',
    private_key: 'k',
  });
  assert.ok(errors({ ...good, IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON: other })
    .includes('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON'));
  assert.ok(errors({ ...good, IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON: '{broken' })
    .includes('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON'));
});

test('Admin production rejects Firebase business-data credentials', () => {
  const serviceAccount = JSON.stringify({
    project_id: 'freepasserp5',
    client_email: 'EMAIL_REDACTED',
    private_key: 'k',
  });
  assert.ok(errors({ ...good, ERP5_FIREBASE_SERVICE_ACCOUNT_JSON: serviceAccount })
    .includes('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON'));
  assert.ok(errors({ ...good, ERP5_SERVICE_ACCOUNT_PATH: '/tmp/erp5.json' })
    .includes('ERP5_SERVICE_ACCOUNT_PATH'));
});

test('unapproved FreePass Data catalog cutover mode is blocked', () => {
  assert.ok(errors({ ...good, FREEPASS_DATA_ADMIN_CATALOG_READ_MODE: 'SHADOW_READ' })
    .includes('FREEPASS_DATA_ADMIN_CUTOVER_JSON'));
  assert.ok(errors({ ...good, FREEPASS_DATA_ADMIN_CATALOG_READ_MODE: 'FREEPASS_DATA_READ' })
    .includes('FREEPASS_DATA_ADMIN_CUTOVER_JSON'));
  assert.equal(errors({ ...good, FREEPASS_DATA_ADMIN_CATALOG_READ_MODE: 'OBSERVE' })
    .includes('FREEPASS_DATA_ADMIN_CUTOVER_JSON'), false);
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
    FREEPASS_DATA_ADMIN_CATALOG_TOKEN:token,
    FREEPASS_DATA_ADMIN_CUTOVER_JSON:cutover,
  };
  const findings=checkDeployEnv(env);
  assert.ok(findings.some((x)=>
    x.key==='FREEPASS_DATA_ADMIN_CUTOVER_JSON'
    && x.level==='error'
    && /중앙 FreePass Data 레지스트리 단계\(OBSERVE\)/.test(x.message)
  ));
});

test('public addresses must be one https origin without a path', () => {
  assert.ok(errors({ ...good, CLAIM_LINK_BASE: 'http://freepass-admin.vercel.app' }).includes('CLAIM_LINK_BASE'));
  assert.ok(errors({ ...good, PUBLIC_BASE_URL: 'https://other.vercel.app' }).includes('APP_BASE_URL'));
  assert.ok(errors({ ...good, APP_BASE_URL: 'https://freepass-admin.vercel.app/login' }).includes('APP_BASE_URL'));
});

test('emulator and demo settings are blocked in production validation', () => {
  assert.ok(errors({ ...good, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }).includes('FIRESTORE_EMULATOR_HOST'));
  assert.ok(errors({ ...good, FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199' }).includes('FIREBASE_STORAGE_EMULATOR_HOST'));
  assert.ok(errors({ ...good, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }).includes('FIREBASE_AUTH_EMULATOR_HOST'));
  assert.ok(errors({ ...good, IDENTITY_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }).includes('IDENTITY_FIREBASE_AUTH_EMULATOR_HOST'));
  assert.ok(errors({ ...good, FPA_DEMO: 'on' }).includes('FPA_DEMO'));
});

test('ERP5_WRITE=on requires the explicit FreePass Data workflow write gate', () => {
  assert.ok(errors({ ...good, ERP5_WRITE: 'on' }).includes('FREEPASS_DATA_ADMIN_WORKFLOW_WRITE'));
  const approved = checkDeployEnv({
    ...good,
    ERP5_WRITE: 'on',
    FREEPASS_DATA_ADMIN_WORKFLOW_WRITE: 'on',
  });
  assert.deepEqual(approved.filter((x) => x.level === 'error'), []);
  assert.ok(approved.some((x) => x.key === 'ERP5_WRITE' && x.level === 'ok'));
});

test('e-sign remains a launch-scope warning rather than bypassing data guards', () => {
  const f = checkDeployEnv({ ...good, ESIGN_ENABLED: 'on' });
  assert.deepEqual(f.filter((x) => x.level === 'error'), []);
  assert.ok(f.some((x) => x.key === 'ESIGN_ENABLED' && x.level === 'warn'));
});

test('Vercel production requires private FreePass Data Cloud Run WIF caller settings', () => {
  const missing = errors({ ...good, VERCEL_ENV: 'production' });
  assert.ok(missing.includes('FREEPASS_DATA_GCP_WIF_AUDIENCE'));
  assert.ok(missing.includes('FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL'));

  const configured = checkDeployEnv({
    ...good,
    VERCEL_ENV: 'production',
    IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON: undefined,
    IDENTITY_GCP_WIF_AUDIENCE: IDENTITY_WIF_AUDIENCE,
    IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL: IDENTITY_SERVICE_ACCOUNT,
    FREEPASS_DATA_GCP_WIF_AUDIENCE: '//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/pool/providers/vercel',
    FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL: 'EMAIL_REDACTED',
  });
  assert.deepEqual(configured.filter((x) => x.level === 'error'), []);
});

test('static Cloud Run ID token is diagnostic-only in Vercel production', () => {
  const findings = checkDeployEnv({
    ...good,
    VERCEL_ENV: 'production',
    FREEPASS_DATA_GCP_WIF_AUDIENCE: '//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/pool/providers/vercel',
    FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL: 'EMAIL_REDACTED',
    FREEPASS_DATA_CLOUD_RUN_ID_TOKEN: 'diagnostic',
  });
  assert.ok(findings.some((x) => x.key === 'FREEPASS_DATA_CLOUD_RUN_ID_TOKEN' && x.level === 'warn'));
});
