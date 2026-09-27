import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath } from '../auth.js';

describe('로그인 없이 열리는 길', () => {
  it('청구 링크 · 고객 전자계약 · 사진 · 로그인은 공개한다', () => {
    for (const p of [
      '/c/abc',
      '/sign/token-123',
      '/api/esign/public/token-123',
      '/api/esign/public/token-123/asset',
      '/api/img',
      '/login',
      '/_next/static/x.js',
      '/favicon.ico',
    ]) assert.ok(isPublicPath(p), p);

    for (const p of [
      '/',
      '/intake',
      '/settlement',
      '/products',
      '/esign',
      '/api/esign/asset/session/id_card',
      '/api/esign/document/session',
      '/c',
      '/login2',
      '/api/other',
      '/design',
    ]) assert.ok(!isPublicPath(p), p);
  });
});

import { verifySession } from '../auth.js';
import { googleSessionOf } from '../google-login.js';
/* 모듈은 설정을 «부를 때» 읽는다 */
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-000';
process.env.GOOGLE_WORKSPACE_DOMAIN = 'teamjpk.com';

describe('문은 구글 워크스페이스 하나 — 대표 2026-09-27 「ERP3는 이제 안 쓰는 건데」', () => {
  it('구글 세션(g1.…)만 연다', async () => {
    const u = { uid: 'google:1', email: 'kjs@teamjpk.com', name: 'kjs' };
    assert.deepEqual(await verifySession(googleSessionOf(u)), { uid: u.uid, name: u.name, role: 'admin', email: u.email });
  });

  it('★erp4(freepasserp3) 세션 쿠키 꼴은 열리지 않는다 — 폐기한 창고로 되돌아가지 않게', async () => {
    /* Firebase 세션 쿠키는 점 셋으로 나뉜 JWT 다. 그 꼴로 와도 g1. 이 아니면 문을 열지 않는다 */
    const firebaseLike = ['eyJhbGciOiJSUzI1NiJ9', 'eyJ1aWQiOiJ1aWQtdGVzdCJ9', 'c2ln'].join('.');
    assert.equal(await verifySession(firebaseLike), null);
  });

  it('쿠키가 없거나 위조면 열리지 않는다', async () => {
    assert.equal(await verifySession(undefined), null);
    const [p, body] = googleSessionOf({ uid: 'google:2', email: 'x@teamjpk.com', name: 'x' }).split('.');
    assert.equal(await verifySession(`${p}.${body}.wrong-signature`), null);
  });

  it('워크스페이스 밖 주소는 세션이 있어도 열리지 않는다', async () => {
    assert.equal(await verifySession(googleSessionOf({ uid: 'google:3', email: 'someone@gmail.com', name: 'someone' })), null);
  });
});
