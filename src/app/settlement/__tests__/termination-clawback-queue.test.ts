import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('settlement actual route exposes the domain termination clawback queue', () => {
  const page = readFileSync('src/app/settlement/page.tsx', 'utf8');
  assert.match(page, /pendingTerminationClawbackRows\(rows, cb\)/);
  assert.match(page, /terminationClawbackReview\(r, cb\)/);
  assert.match(page, /followup\) === 'clawback'/);
  assert.match(page, /환수검토/);
  assert.match(page, /환수 금액 등록 필요/);
  assert.match(page, /<IntakeDetailPanel code=\{ic\}/);
});

test('termination review UI uses the existing intake detail instead of a second settlement state machine', () => {
  const detail = readFileSync('src/app/intake/IntakeDetailPanel.tsx', 'utf8');
  const form = readFileSync('src/app/intake/MoneyForm.tsx', 'utf8');
  assert.match(detail, /terminationClawbackReview\(r, clawbacks\)/);
  assert.match(detail, /TerminationClawbackReviewForm/);
  assert.match(detail, /환수 필요로 확정됐습니다/);
  assert.match(detail, /<ClawbackForm code=\{r\.id\}/);
  assert.match(form, /terminationClawbackReviewAction/);
  assert.match(form, /name="decision" value="NOT_REQUIRED"/);
  assert.match(form, /name="decision" value="REQUIRED"/);
});

test('termination review persistence is atomic and operation-id guarded', () => {
  const repo = readFileSync('src/adapters/erp5/settlement-repository.ts', 'utf8');
  const actions = readFileSync('src/app/intake/actions.ts', 'utf8');
  assert.match(repo, /async reviewTerminationClawback/);
  assert.match(repo, /planTerminationClawbackReview/);
  assert.match(repo, /db\.runTransaction/);
  assert.match(repo, /aud_clawback_review_/);
  assert.match(actions, /terminationClawbackReviewAction/);
  assert.match(actions, /\^\[A-Za-z0-9_-\]\{16,128\}\$/);
});
