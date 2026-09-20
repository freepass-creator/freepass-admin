import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { FileApplicationRepository, FileProductRepository } from '../../store/repositories';
import { offer, product } from '../../../domain/search/__tests__/fixtures';
import { cancel, markProgress, submitApplication, type Deps, type SubmitApplicationInput } from '../../../services/applications';
import {
  CORE_WORKFLOW_ID,
  CORE_WORKFLOW_PROJECTION_ID,
  CORE_WORKFLOW_REVISION,
  applicationToWorkflowShadow,
  assertApplicationWorkflowShadowParity,
} from '../workflow-shadow';

let dir: string;
let sequence = 0;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fpa-workflow-shadow-'));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

function deps(box: string): Deps {
  const root = join(dir, box);
  return {
    products: new FileProductRepository(root),
    applications: new FileApplicationRepository(root),
    now: () => new Date('2026-09-20T01:00:00.000Z'),
    newId: () => `app-d-shadow-${++sequence}`,
    actors: {
      requireActor: async () => ({ id: 'staff-park', type: 'ADMIN' as const }),
    },
  };
}

const input = (over: Partial<SubmitApplicationInput> = {}): SubmitApplicationInput => ({
  productId: 'product-1',
  offerId: 'offer-36',
  salesChannelId: 'channel-1',
  assigneeId: 'staff-park',
  applicantName: '김서연',
  expectedProductVersion: 1,
  submissionId: 'workflow-shadow-submit',
  ...over,
});

describe('AI Core D workflow SHADOW binding', () => {
  it('pins the exact Core workflow/projection revision without claiming runtime authority', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../../../../contracts/ai-core/application-workflow.shadow.json', import.meta.url), 'utf8'),
    );

    assert.equal(manifest.binding_state, 'SHADOW');
    assert.equal(manifest.runtime_authority, 'FREEPASS_ADMIN_DOMAIN');
    assert.equal(manifest.core.revision, CORE_WORKFLOW_REVISION);
    assert.equal(manifest.core.workflow_id, CORE_WORKFLOW_ID);
    assert.equal(manifest.core.projection_id, CORE_WORKFLOW_PROJECTION_ID);
    assert.equal(manifest.local.source_revision, '77f682af680528124096e4f7871504a3596c8990');
    assert.equal(manifest.local.source_files.length, 4);
    assert.equal(manifest.enforcement.writes_routed_through_ai_core_engine, false);
    assert.equal(manifest.enforcement.projection_parity_checked_in_ci, true);
  });

  it('replays real service progress through the D projection without inventing writable status transitions', async () => {
    const d = deps('progress');
    await d.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));

    const submitted = await submitApplication(d, input());
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;

    let shadow = assertApplicationWorkflowShadowParity(submitted.application);
    assert.equal(shadow.states.lifecycle, 'ACTIVE');
    assert.equal(shadow.projection.value, 'RECEIVED');

    const documents = await markProgress(d, submitted.application.id, 'documentsCompleted', true);
    assert.equal(documents.ok, true);
    if (!documents.ok) return;
    shadow = assertApplicationWorkflowShadowParity(documents.application);
    assert.equal(shadow.facts['application.documents-completed'], true);
    assert.equal(shadow.projection.value, 'RECEIVED');

    const balance = await markProgress(d, submitted.application.id, 'balanceCompleted', true);
    assert.equal(balance.ok, true);
    if (!balance.ok) return;
    shadow = assertApplicationWorkflowShadowParity(balance.application);
    assert.equal(shadow.facts['application.balance-completed'], true);
    assert.equal(shadow.projection.value, 'RECEIVED');

    const contracted = await markProgress(d, submitted.application.id, 'contractCompleted', true);
    assert.equal(contracted.ok, true);
    if (!contracted.ok) return;
    shadow = assertApplicationWorkflowShadowParity(contracted.application);
    assert.equal(shadow.projection.value, 'CONTRACTED');

    const delivered = await markProgress(d, submitted.application.id, 'deliveryCompleted', true);
    assert.equal(delivered.ok, true);
    if (!delivered.ok) return;
    shadow = assertApplicationWorkflowShadowParity(delivered.application);
    assert.equal(shadow.projection.value, 'DELIVERED');
  });

  it('treats cancellation as authoritative lifecycle and preserves source rejection after cancellation', async () => {
    const d = deps('cancel');
    await d.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));

    const submitted = await submitApplication(d, input({ submissionId: 'workflow-shadow-cancel' }));
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;

    await markProgress(d, submitted.application.id, 'contractCompleted', true);
    await markProgress(d, submitted.application.id, 'deliveryCompleted', true);

    const cancelled = await cancel(d, submitted.application.id, '고객 변심');
    assert.equal(cancelled.ok, true);
    if (!cancelled.ok) return;

    const shadow = assertApplicationWorkflowShadowParity(cancelled.application);
    assert.equal(shadow.states.lifecycle, 'CANCELLED');
    assert.equal(shadow.projection.value, 'CANCELLED');
    assert.equal(shadow.facts['application.cancellation-reason'], '고객 변심');

    const after = await markProgress(d, submitted.application.id, 'deliveryCompleted', false);
    assert.equal(after.ok, false);
    assert.equal(!after.ok && after.reason, 'CANCELLED');
  });

  it('fails closed if stored source status and D-derived projection drift apart', async () => {
    const d = deps('negative');
    await d.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));
    const submitted = await submitApplication(d, input({ submissionId: 'workflow-shadow-negative' }));
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;

    const corrupted = {
      ...submitted.application,
      status: 'CONTRACTED' as const,
      progress: { ...submitted.application.progress, contractCompleted: false },
    };

    const shadow = applicationToWorkflowShadow(corrupted);
    assert.equal(shadow.projection.value, 'RECEIVED');
    assert.throws(
      () => assertApplicationWorkflowShadowParity(corrupted),
      /AI_CORE_WORKFLOW_SHADOW_DRIFT/,
    );
  });
});
