import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath } from '../auth.js';

describe('로그인 없이 열리는 길', () => {
  it('청구 링크 · 사진 · 로그인만', () => {
    for (const p of ['/c/abc', '/api/img', '/login', '/_next/static/x.js', '/favicon.ico']) assert.ok(isPublicPath(p), p);
    for (const p of ['/', '/intake', '/settlement', '/products', '/esign', '/c', '/login2', '/api/other', '/design']) assert.ok(!isPublicPath(p), p);
  });
});
