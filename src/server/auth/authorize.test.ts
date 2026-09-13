import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeSession } from './authorize';
import { AccessError } from './errors';
import type { SessionVerifier, StaffAccountReader, StaffAccountRecord } from './types';

function dependencies(input: {
  verify?: () => Promise<{ uid: string }>;
  account?: StaffAccountRecord | null;
}) {
  let verifyCalls = 0;
  let accountCalls = 0;
  const sessionVerifier: SessionVerifier = {
    async verifySessionCookie() {
      verifyCalls += 1;
      return input.verify ? input.verify() : { uid: 'staff-1' };
    },
  };
  const staffAccounts: StaffAccountReader = {
    async findByUid() {
      accountCalls += 1;
      return input.account ?? null;
    },
  };
  return { sessionVerifier, staffAccounts, calls: () => ({ verifyCalls, accountCalls }) };
}

async function rejectsWithCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error) => error instanceof AccessError && error.code === code);
}

test('missing session is rejected before verifier or account access', async () => {
  const deps = dependencies({ account: { role: 'ADMIN', status: 'ACTIVE' } });
  await rejectsWithCode(authorizeSession(undefined, 'APPLICATION_MANAGE', deps), 'UNAUTHENTICATED');
  assert.deepEqual(deps.calls(), { verifyCalls: 0, accountCalls: 0 });
});

test('invalid or revoked session is rejected before account access', async () => {
  const deps = dependencies({ verify: async () => { throw new Error('revoked'); } });
  await rejectsWithCode(authorizeSession('invalid', 'PRODUCT_SEARCH', deps), 'UNAUTHENTICATED');
  assert.deepEqual(deps.calls(), { verifyCalls: 1, accountCalls: 0 });
});

test('SALES can search products but cannot call ADMIN mutations', async () => {
  const deps = dependencies({ account: { role: 'SALES', status: 'ACTIVE' } });
  const principal = await authorizeSession('valid', 'PRODUCT_SEARCH', deps);
  assert.deepEqual(principal, { uid: 'staff-1', role: 'SALES', status: 'ACTIVE' });
  await rejectsWithCode(authorizeSession('valid', 'APPLICATION_MANAGE', deps), 'ROLE_NOT_ALLOWED');
});

test('ADMIN can call workflow mutations and actor uid comes from the verified session', async () => {
  const deps = dependencies({
    verify: async () => ({ uid: 'verified-admin' }),
    account: { role: 'ADMIN', status: 'ACTIVE' },
  });
  const principal = await authorizeSession('valid', 'SETTLEMENT_MANAGE', deps);
  assert.equal(principal.uid, 'verified-admin');
  assert.equal(principal.role, 'ADMIN');
});

test('disabled, missing, unknown and WHITE_LABEL accounts fail closed', async () => {
  for (const account of [
    { role: 'ADMIN', status: 'DISABLED' },
    { role: 'UNKNOWN', status: 'ACTIVE' },
    { role: 'WHITE_LABEL', status: 'ACTIVE' },
    null,
  ]) {
    const deps = dependencies({ account });
    await assert.rejects(authorizeSession('valid', 'PRODUCT_SEARCH', deps), AccessError);
  }
});

test('the authoritative staff account role controls authorization', async () => {
  const deps = dependencies({ account: { role: 'SALES', status: 'ACTIVE' } });
  await rejectsWithCode(authorizeSession('valid', 'APPLICATION_MANAGE', deps), 'ROLE_NOT_ALLOWED');
});

test('AUTH_NOT_CONFIGURED is preserved instead of being reported as a bad session', async () => {
  const deps = dependencies({
    verify: async () => { throw new AccessError('AUTH_NOT_CONFIGURED', 503); },
  });
  await rejectsWithCode(authorizeSession('present', 'PRODUCT_SEARCH', deps), 'AUTH_NOT_CONFIGURED');
});
