import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('./IntakeDetailPanel.tsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('./IntakeSide.tsx', import.meta.url), 'utf8');
const draft = readFileSync(new URL('../products/BoardIntakeForm.tsx', import.meta.url), 'utf8');

test('접수 초안은 기본 확인창 없이 이탈을 안내하고 미리보기 디바운스가 수동 입력을 초기화하지 않는다', () => {
  assert.doesNotMatch(draft, /window\.confirm/);
  assert.ok(draft.includes('leaveNotice.current?.scrollIntoView'));
  assert.ok(draft.includes('!pending && state.errors.length'));
  const debounce = draft.slice(draft.indexOf('const 첫판'), draft.indexOf('const 직접'));
  assert.doesNotMatch(debounce, /set미리\(fee\)/);
  assert.ok(debounce.includes('if (active) set미리(result)'));
  assert.ok(draft.includes('useRef(defaults.intakeRequestId)'));
});

test('메인 접수 상세도 같은 금액 정본과 관측시점을 사용한다', () => {
  for (const fn of ['claimAmountOf', 'payAmountOf', 'marginOf', 'billingMonth', 'stageOf']) assert.ok(main.includes(`${fn}(r, now)`));
  assert.doesNotMatch(main, /청구\s*-\s*\(지급\s*\?\?\s*0\)/);
  assert.match(main, /마진 === null \? '미확인'/);
});

test('메인 상세는 직접 접수 식별값으로 이력을 조회하고 실제 정산 route로 연결한다', () => {
  assert.ok(main.includes('r.catalogRef?.productId, hit.raw.intakeRequestId, hit.raw.intakeIdentityMode'));
  assert.match(main, /settleHref=\{`\/settlement\?tab=/);
  assert.doesNotMatch(main, /\/performance\?/);
  for (const field of ['PaidRounds', 'r.note', 'r.catalogSnapshot', 'nextInstallmentDate(r)']) assert.ok(main.includes(field));
});

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
