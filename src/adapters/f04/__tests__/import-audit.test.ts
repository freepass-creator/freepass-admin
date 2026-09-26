import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('F04 importer creates settlement row and initial audit event in the same batch path', () => {
  const source = readFileSync('scripts/f04-fill-erp5.mts', 'utf8');
  assert.match(source, /const EVENTS = 'settlement_events'/);
  assert.match(source, /data\.auditEventId = auditEventId/);
  assert.match(source, /db\.collection\(ROWS\)\.doc\(x\.id\)/);
  assert.match(source, /db\.collection\(EVENTS\)\.doc\(x\.auditEventId\)/);
  assert.match(source, /by: 'f04-import'/);
  assert.match(source, /묶음\(새줄, 200\)/);
});
