import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { finishGoogle, googleSessionOf, verifyGoogleSession } from '../google-login.js';
/* 모듈은 설정을 «부를 때» 읽는다 — 여기서 넣어도 된다 */
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-000';
process.env.GOOGLE_WORKSPACE_DOMAIN = 'teamjpk.com';

describe('구글 워크스페이스 세션 — 우리가 서명한 봉투', () => {
  const u = { uid: 'google:1', email: 'kjs@teamjpk.com', name: 'kjs' };
  it('발급한 세션은 열린다', () => assert.deepEqual(verifyGoogleSession(googleSessionOf(u)), u));
  it('★한 글자라도 고치면 안 열린다(위조)', () => {
    const t = googleSessionOf(u);
    const [p, body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...u, email: 'evil@teamjpk.com', exp: Date.now() + 1e9 })).toString('base64url');
    assert.equal(verifyGoogleSession(`${p}.${forged}.${sig}`), null);
    assert.equal(verifyGoogleSession(`${p}.${body}.${sig.slice(0, -1)}x`), null);
  });
  it('만료되면 안 열린다', () => assert.equal(verifyGoogleSession(googleSessionOf(u, Date.now() - 6 * 24 * 3600_000)), null));
  it('★도메인을 다시 본다 — 설정을 바꾸면 옛 세션도 막힌다', () => {
    const t = googleSessionOf(u);
    process.env.GOOGLE_WORKSPACE_DOMAIN = 'other.com';
    assert.equal(verifyGoogleSession(t), null);
    process.env.GOOGLE_WORKSPACE_DOMAIN = 'teamjpk.com';
  });
  it('로그인 중간 봉투(state)가 없거나 다르면 끊는다', async () => {
    assert.equal((await finishGoogle('http://x', { code: 'c', state: 's' }, undefined)).ok, false);
    assert.equal((await finishGoogle('http://x', { code: 'c', state: 's' }, 'o1.garbage.sig')).ok, false);
  });
});
