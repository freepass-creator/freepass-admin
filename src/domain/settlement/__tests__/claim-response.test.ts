import test from 'node:test';
import assert from 'node:assert/strict';
import { planClaimResponse } from '../claim-link';

test('first confirmation records the issued invoice response', () => {
  const r = planClaimResponse(null, '확인', '', [], ['a', 'b'], 100);
  assert.deepEqual(r, {
    ok: true,
    response: { state: '확인', at: 100 },
    target: ['a', 'b'],
    idempotent: false,
  });
});

test('exact confirmation retry is idempotent and keeps original receipt time', () => {
  const existing = { state: '확인' as const, at: 100 };
  const r = planClaimResponse(existing, '확인', '', [], ['a', 'b'], 200);
  assert.deepEqual(r, {
    ok: true,
    response: existing,
    target: ['a', 'b'],
    idempotent: true,
  });
});

test('exact dispute retry is idempotent even when selected-code order changes', () => {
  const existing = { state: '이의' as const, at: 100, memo: '금액 다름', codes: ['a', 'b'] };
  const r = planClaimResponse(existing, '이의', '금액 다름', ['b', 'a'], ['a', 'b', 'c'], 200);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.idempotent, true);
  assert.deepEqual(r.response, existing);
});

test('an answered invoice cannot be changed without reissue', () => {
  const confirmed = { state: '확인' as const, at: 100 };
  const changed = planClaimResponse(confirmed, '이의', '다름', ['a'], ['a'], 200);
  assert.equal(changed.ok, false);

  const disputed = { state: '이의' as const, at: 100, memo: '금액 다름', codes: ['a'] };
  const edited = planClaimResponse(disputed, '이의', '다른 사유', ['a'], ['a'], 200);
  assert.equal(edited.ok, false);
});

test('dispute validates memo and selected issued lines', () => {
  assert.equal(planClaimResponse(null, '이의', '', ['a'], ['a'], 100).ok, false);
  assert.equal(planClaimResponse(null, '이의', '다름', ['x'], ['a'], 100).ok, false);

  const r = planClaimResponse(null, '이의', '다름', [], ['a', 'b'], 100);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.response.codes, ['a', 'b']);
});
