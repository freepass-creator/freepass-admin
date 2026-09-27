/**
 * serverExternalPackages 는 런타임에 CJS require 로 불린다.
 * jwks-rsa@4(CJS) 가 ESM 전용 jose@6 을 require 하면 require(esm) 없는 런타임에서
 * firebase-admin/auth 로드가 깨지고 모든 route 가 500 이 된다 (2026-09-27 운영 배포 실측).
 * `--no-experimental-require-module` 로 그 런타임을 재현해 회귀를 막는다.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const externals = [
  'firebase-admin/app',
  'firebase-admin/auth',
  'firebase-admin/firestore',
  'firebase-admin/storage',
];

for (const id of externals) {
  test(`${id} loads under CJS require without require(esm)`, () => {
    assert.doesNotThrow(() =>
      execFileSync(process.execPath, ['--no-experimental-require-module', '-e', `require(${JSON.stringify(id)})`], {
        cwd: process.cwd(),
        stdio: 'pipe',
      }),
    );
  });
}
