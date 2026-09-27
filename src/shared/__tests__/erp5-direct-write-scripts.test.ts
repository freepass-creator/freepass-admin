import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = readdirSync('scripts')
  .filter((name) => /\.(?:mts|ts|mjs|js|cjs)$/.test(name))
  .map((name) => join('scripts', name));

const firestoreWrite = (source: string) => {
  const reachesFirestore =
    /firebase-admin\/firestore/.test(source)
    || /adapters\/erp5\/firestore/.test(source);
  const writes =
    /\b(?:w|batch)\.(?:set|update|create|delete)\(/.test(source)
    || /db\.collection\([^\n]+\)\.doc\([^\n]+\)\.(?:set|update|create|delete)\(/.test(source);
  return reachesFirestore && writes;
};

test('direct ERP5 write scripts cannot bypass the maintenance approval gate', () => {
  const candidates = files
    .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
    .filter(({ source }) => firestoreWrite(source));

  assert.ok(candidates.length >= 5, 'expected known ERP5 maintenance writers');

  /**
   * A script that binds itself to an emulator host cannot touch the operational store, so the
   * maintenance approval gate does not apply to it. Judged by what the source does rather than by
   * its name, so a new emulator-only check does not have to be added to a list to be recognised.
   */
  const emulatorBound = (source: string) =>
    /process\.env\.(?:FIRESTORE|FIREBASE_AUTH|FIREBASE_STORAGE)_EMULATOR_HOST\s*=/.test(source);

  for (const { file, source } of candidates) {
    if (emulatorBound(source)) {
      assert.doesNotMatch(source, /ERP5_FIREBASE_SERVICE_ACCOUNT_JSON|ERP5_SERVICE_ACCOUNT_PATH/, `${file} must not reach for operational credentials`);
      continue;
    }
    assert.match(source, /assertErp5MaintenanceWrite/, file);
    assert.match(source, /--apply|APPLY/, file);
  }
});
