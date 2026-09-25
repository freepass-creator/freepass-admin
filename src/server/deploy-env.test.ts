import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDeployEnv } from './deploy-env';

const sa = JSON.stringify({ project_id: 'freepasserp5', client_email: 'x@freepasserp5.iam.gserviceaccount.com', private_key: 'k' });
const good = {
  SESSION_SECRET: 'a'.repeat(48),
  GOOGLE_OAUTH_CLIENT_ID: '123.apps.googleusercontent.com',
  GOOGLE_OAUTH_CLIENT_SECRET: 's',
  ERP5_FIREBASE_SERVICE_ACCOUNT_JSON: sa,
  ERP5_WRITE: 'off',
  APP_BASE_URL: 'https://freepass-admin.vercel.app',
  PUBLIC_BASE_URL: 'https://freepass-admin.vercel.app',
  CLAIM_LINK_BASE: 'https://freepass-admin.vercel.app/',
};
const errors = (env: Record<string, string | undefined>) => checkDeployEnv(env).filter((f) => f.level === 'error').map((f) => f.key);

test('complete first-deploy env has no errors and never echoes secret values', () => {
  const findings = checkDeployEnv(good);
  assert.deepEqual(findings.filter((f) => f.level === 'error'), []);
  const text = JSON.stringify(findings);
  assert.equal(text.includes('a'.repeat(48)), false);
  assert.equal(text.includes('"k"'), false);
});

test('missing login and data credentials are errors', () => {
  assert.deepEqual(errors({}).sort(), ['ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'SESSION_SECRET'].sort());
});

test('service account from another Firebase project is rejected', () => {
  const other = JSON.stringify({ project_id: 'freepasserp3', client_email: 'x', private_key: 'k' });
  assert.ok(errors({ ...good, ERP5_FIREBASE_SERVICE_ACCOUNT_JSON: other }).includes('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON'));
  assert.ok(errors({ ...good, ERP5_FIREBASE_SERVICE_ACCOUNT_JSON: '{broken' }).includes('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON'));
});

test('public addresses must be one https origin without a path', () => {
  assert.ok(errors({ ...good, CLAIM_LINK_BASE: 'http://freepass-admin.vercel.app' }).includes('CLAIM_LINK_BASE'));
  assert.ok(errors({ ...good, PUBLIC_BASE_URL: 'https://other.vercel.app' }).includes('APP_BASE_URL'));
  assert.ok(errors({ ...good, APP_BASE_URL: 'https://freepass-admin.vercel.app/login' }).includes('APP_BASE_URL'));
});

test('emulator hosts and short session secrets are blocked; write on and esign on only warn', () => {
  assert.ok(errors({ ...good, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }).includes('FIRESTORE_EMULATOR_HOST'));
  assert.ok(errors({ ...good, SESSION_SECRET: 'short' }).includes('SESSION_SECRET'));
  const f = checkDeployEnv({ ...good, ERP5_WRITE: 'on', ESIGN_ENABLED: 'on' });
  assert.deepEqual(f.filter((x) => x.level === 'error'), []);
  assert.ok(f.some((x) => x.key === 'ERP5_WRITE' && x.level === 'warn'));
  assert.ok(f.some((x) => x.key === 'ESIGN_ENABLED' && x.level === 'warn'));
});
