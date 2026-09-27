import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath, looksLikeSession } from '../auth.js';

describe('로그인 없이 열리는 길', () => {
  it('청구 링크 · 고객 전자계약 · 사진 · 글꼴 · 로그인은 공개한다', () => {
    for (const p of [
      '/c/abc',
      '/sign/token-123',
      '/api/esign/public/token-123',
      '/api/esign/public/token-123/asset',
      '/api/img',
      '/login',
      /* 공용 로그인 화면이 Firebase 로 사람을 확인한 뒤 토큰을 맡기는 곳 — 그때는 아직 쿠키가 없다 */
      '/api/session',
      '/fonts/pretendard/pretendard.css',
      '/fonts/pretendard/woff2-dynamic-subset/PretendardVariable.subset.0.woff2',
      '/fonts/OFL-Pretendard.txt',
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

describe('proxy 의 쿠키 눈대중 — 이것만으로는 아무도 못 들어온다', () => {
  /**
   * ★proxy 는 모든 요청 앞에서 도는 자리라 firebase-admin 을 싣지 않는다. 쿠키 «꼴»만 본다.
   *   진짜 검증(서명 · 취소 · 승인 · grant)은 require-admin.ts → identity.ts 가 쪽과 서버 액션 앞에서 한다.
   */
  it('Firebase 세션 쿠키 꼴이 아니면 문 앞에서 걷는다', () => {
    for (const bad of [undefined, '', 'abc', 'a.b', 'a.b.c', `g1.${'x'.repeat(40)}`, 'x'.repeat(200)]) {
      assert.equal(looksLikeSession(bad), false, String(bad));
    }
  });

  it('꼴이 맞으면 지나가되, 지나간 것이 권한은 아니다', () => {
    assert.ok(looksLikeSession(['eyJhbGciOiJSUzI1NiJ9', 'x'.repeat(40), 'c2ln'].join('.')));
  });
});
