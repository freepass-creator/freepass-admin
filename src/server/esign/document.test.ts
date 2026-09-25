import assert from 'node:assert/strict';
import test from 'node:test';
import { formatKstSignedAt } from './document';

test('signed-at text is fixed KST and independent of the Node ICU version', () => {
  // Matches Node 24 (ICU 78.3) ko-KR medium/short output used in production.
  assert.equal(formatKstSignedAt(Date.parse('2026-09-25T05:30:00Z')), '2026. 9. 25. 오후 2:30');
  assert.equal(formatKstSignedAt(Date.parse('2026-09-24T15:05:00Z')), '2026. 9. 25. 오전 12:05');
  assert.equal(formatKstSignedAt(Date.parse('2026-09-25T03:00:00Z')), '2026. 9. 25. 오후 12:00');
  assert.equal(formatKstSignedAt(Date.parse('2026-12-31T14:59:00Z')), '2026. 12. 31. 오후 11:59');
  assert.equal(formatKstSignedAt(Date.parse('2026-12-31T15:00:00Z')), '2027. 1. 1. 오전 12:00');
});
