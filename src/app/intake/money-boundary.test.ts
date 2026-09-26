import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('./IntakeDetailPanel.tsx', import.meta.url), 'utf8');

test('접수 상세 마진은 E 정본을 표시하고 미정 지급액을 0으로 재계산하지 않는다', () => {
  assert.match(panel, /import \{ marginOf \} from '\.\.\/\.\.\/domain\/settlement\/money'/);
  assert.match(panel, /const 마진 = marginOf\(r, now\)/);
  assert.match(panel, /label="남는 것">\{won\(마진\)\}/);
  assert.doesNotMatch(panel, /청구\s*-\s*\(지급\s*\?\?\s*0\)/);
});

test('한 접수 상세의 금액·청구월·실적 판정은 같은 관측시점을 소비한다', () => {
  assert.match(panel, /const now = new Date\(\)/);
  for (const fn of ['claimAmountOf', 'payAmountOf', 'marginOf', 'billingMonth', 'stageOf']) {
    assert.ok(panel.includes(`${fn}(r, now)`), `${fn} must receive the shared observation time`);
  }
});
