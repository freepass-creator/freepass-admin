import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath } from '../auth.js';

describe('로그인 없이 열리는 길', () => {
  it('청구 링크 · 사진 · 로그인만', () => {
    for (const p of ['/c/abc', '/api/img', '/login', '/_next/static/x.js', '/favicon.ico']) assert.ok(isPublicPath(p), p);
    for (const p of ['/', '/intake', '/settlement', '/products', '/esign', '/c', '/login2', '/api/other', '/design']) assert.ok(!isPublicPath(p), p);
  });
});

import { adminOf } from '../auth.js';
describe('ADMIN_EMAILS — 대표 「이 두명은 로그인되게」', () => {
  it('목록의 이메일은 ERP5 user 문서 없이도 관리자 · 대소문자 안 가림', async () => {
    process.env.ADMIN_EMAILS = 'pyh@teamjpk.com, kjs@teamjpk.com';
    process.env.ADMIN_UIDS = 'uid-test-1,uid-test-2';
    assert.equal((await adminOf('uid-test-1', 'PYH@teamjpk.com'))?.role, 'admin');
    assert.equal((await adminOf('uid-test-2', 'kjs@teamjpk.com'))?.name, 'kjs');
  });
});
