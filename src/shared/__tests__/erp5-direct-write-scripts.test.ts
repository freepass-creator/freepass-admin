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
    /\.batch\(\)/.test(source)
    || /\.(?:set|update|create|delete)\(/.test(source);
  return reachesFirestore && writes;
};

test('direct ERP5 write scripts cannot bypass the maintenance approval gate', () => {
  const candidates = files
    .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
    .filter(({ source }) => firestoreWrite(source));

  assert.ok(candidates.length >= 5, 'expected known ERP5 maintenance writers');

  for (const { file, source } of candidates) {
    if (/verify-esign-pdf-emulator/.test(file)) {
      assert.match(source, /FIRESTORE_EMULATOR_HOST|emulator/i, file);
      continue;
    }
    assert.match(source, /assertErp5MaintenanceWrite/, file);
    assert.match(source, /--apply|APPLY/, file);
  }
});
