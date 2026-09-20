import assert from 'node:assert/strict';
import test from 'node:test';
import { adminAuthMode, adminUidAllowlist, parseAdminAuthServiceAccount, requireAdminUid } from './config';
import { validateCsrf, validateRecentSignIn } from './session';

const sa=(project_id:string)=>JSON.stringify({
  project_id,
  client_email:'admin@example.invalid',
  private_key:'-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
});

test('production auth is unbound unless firebase mode is explicit',()=>{
  assert.equal(adminAuthMode({NODE_ENV:'production'}),'UNBOUND_PRODUCTION');
  assert.equal(adminAuthMode({NODE_ENV:'production',FPA_AUTH_MODE:'firebase'}),'FIREBASE');
  assert.equal(adminAuthMode({NODE_ENV:'development'}),'DEV');
});

test('auth service account must match explicitly configured auth project',()=>{
  const env={
    FPA_AUTH_PROJECT_ID:'freepass-admin-auth-project',
    FPA_AUTH_SERVICE_ACCOUNT_JSON:sa('freepass-admin-auth-project'),
  };
  assert.equal(parseAdminAuthServiceAccount(env).project_id,'freepass-admin-auth-project');
  assert.throws(
    ()=>parseAdminAuthServiceAccount({...env,FPA_AUTH_SERVICE_ACCOUNT_JSON:sa('legacy-project')}),
    /FPA_AUTH_PROJECT_ID_MISMATCH/,
  );
});

test('admin authorization is UID allowlist based, not email based',()=>{
  const env={FPA_ADMIN_UIDS:'uid-a, uid-b'};
  assert.deepEqual([...adminUidAllowlist(env)],['uid-a','uid-b']);
  assert.doesNotThrow(()=>requireAdminUid('uid-a',env));
  assert.throws(()=>requireAdminUid('uid-c',env),/ADMIN_UID_NOT_ALLOWED/);
  assert.throws(()=>requireAdminUid('uid-a',{}),/FPA_ADMIN_UIDS_REQUIRED/);
});

test('session exchange requires same origin, matching csrf and recent sign-in',()=>{
  assert.doesNotThrow(()=>validateCsrf({
    requestUrl:'https://admin.example/api/auth/session',
    origin:'https://admin.example',
    cookie:'token',
    body:'token',
  }));
  assert.throws(()=>validateCsrf({
    requestUrl:'https://admin.example/api/auth/session',
    origin:'https://evil.example',
    cookie:'token',
    body:'token',
  }),/AUTH_ORIGIN_INVALID/);
  assert.throws(()=>validateCsrf({
    requestUrl:'https://admin.example/api/auth/session',
    origin:'https://admin.example',
    cookie:'token',
    body:'different',
  }),/AUTH_CSRF_INVALID/);

  assert.doesNotThrow(()=>validateRecentSignIn(1000,1100));
  assert.throws(()=>validateRecentSignIn(700,1100),/AUTH_RECENT_SIGN_IN_REQUIRED/);
  assert.throws(()=>validateRecentSignIn(1101,1100),/AUTH_RECENT_SIGN_IN_REQUIRED/);
});
