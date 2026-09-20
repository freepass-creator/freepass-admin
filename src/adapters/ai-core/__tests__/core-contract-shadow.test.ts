import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { FileApplicationRepository, FileProductRepository } from '../../store/repositories';
import { AppError } from '../../../domain/errors';
import { offer, product } from '../../../domain/search/__tests__/fixtures';
import { submitApplication, type Deps, type SubmitApplicationInput } from '../../../services/applications';
import {
  CORE_ERROR_CONTRACT,
  CORE_REQUEST_CONTEXT_CONTRACT,
  CORE_SNAPSHOT_CONTRACT,
  appErrorToCore,
  applicationSnapshotToCore,
  serviceReasonToCore,
  submitRequestToCoreContext,
} from '../core-contract-shadow';

let dir: string;
let seq = 0;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fpa-core-shadow-'));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

function deps(box: string): Deps {
  const root = join(dir, box);
  return {
    products: new FileProductRepository(root),
    applications: new FileApplicationRepository(root),
    now: () => new Date('2026-09-19T12:00:00.000Z'),
    newId: () => `app-shadow-${++seq}`,
    actors: {
      requireActor: async () => ({ id: 'staff-park', type: 'ADMIN' as const }),
    },
  };
}

const baseInput = (over: Partial<SubmitApplicationInput> = {}): SubmitApplicationInput => ({
  productId: 'product-1',
  offerId: 'offer-36',
  salesChannelId: 'channel-1',
  assigneeId: 'staff-park',
  applicantName: '김서연',
  expectedProductVersion: 1,
  submissionId: 'shadow-submit-1',
  ...over,
});

describe('AI Core shadow — machine contract bindings', () => {
  it('declares a partial development binding and does not invent the missing ActorProvider adapter', async () => {
    const root = new URL('../../../../contracts/ai-core/', import.meta.url);
    const [service, binding, appPort, productPort, actorPort] = await Promise.all([
      readFile(new URL('application-service.json', root), 'utf8').then(JSON.parse),
      readFile(new URL('development.binding-profile.json', root), 'utf8').then(JSON.parse),
      readFile(new URL('application-repository.port.json', root), 'utf8').then(JSON.parse),
      readFile(new URL('product-read.port.json', root), 'utf8').then(JSON.parse),
      readFile(new URL('actor-provider.port.json', root), 'utf8').then(JSON.parse),
    ]);

    assert.equal(service.schema_version, 'core-application-service-contract/v1');
    assert.equal(service.source.revision, 'git:fb85037969a6c2f4596350b9c66303025be6f19d');
    assert.equal(service.use_cases.find((x: any) => x.name === 'submit_application').idempotency, 'REQUIRED');
    assert.equal(service.use_cases.find((x: any) => x.name === 'mark_progress').idempotency, 'SUPPORTED');
    assert.equal(service.use_cases.find((x: any) => x.name === 'cancel_application').idempotency, 'SUPPORTED');

    assert.equal(appPort.direction, 'MIXED');
    assert.equal(productPort.direction, 'READ');
    assert.equal(actorPort.direction, 'QUERY');

    assert.equal(binding.verification_state, 'PARTIAL');
    const boundPorts = binding.service_bindings[0].ports.map((x: any) => x.port_id);
    assert.ok(boundPorts.includes('application.repository'));
    assert.ok(boundPorts.includes('product.read'));
    assert.ok(!boundPorts.includes('actor.provider'), 'production auth adapter is not verified and must not be invented');
  });
});

describe('AI Core shadow — request/idempotency/snapshot', () => {
  it('replays the same submission and preserves one semantic request identity', async () => {
    const d = deps('idempotency');
    await d.products.save(product({ id: 'product-1', offers: [offer({ id: 'offer-36' })] }));
    const input = baseInput({ submissionId: 'idem-shadow' });
    const actor = { id: 'staff-park', type: 'ADMIN' as const };

    const context1 = submitRequestToCoreContext(input, actor);
    const first = await submitApplication(d, input);
    const context2 = submitRequestToCoreContext({ ...input }, actor);
    const second = await submitApplication(d, input);

    assert.equal(context1.schema_version, CORE_REQUEST_CONTEXT_CONTRACT);
    assert.equal(context1.idempotency.mode, 'REQUIRED');
    assert.equal(context1.idempotency.key, 'idem-shadow');
    assert.equal(context1.correlation_id, 'application:idem-shadow');
    assert.equal(context1.idempotency.semantic_payload_digest, context2.idempotency.semantic_payload_digest);

    assert.equal(first.ok && first.created, true);
    assert.equal(second.ok && second.created, false);
    assert.equal(first.ok && second.ok && first.application.id, second.ok ? second.application.id : '');
  });

  it('keeps the application product snapshot immutable after the live product advances', async () => {
    const d = deps('snapshot');
    await d.products.save(product({
      id: 'product-1',
      offers: [offer({ id: 'offer-36', monthlyRent: 690_000 })],
    }));

    const result = await submitApplication(d, baseInput({ submissionId: 'snapshot-shadow' }));
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const before = applicationSnapshotToCore(result.application);
    assert.equal(before.schema_version, CORE_SNAPSHOT_CONTRACT);
    assert.equal(before.subject_revision, 'product:product-1:v1');
    assert.match(before.payload_digest, /^sha256:[0-9a-f]{64}$/);

    await d.products.save(product({
      id: 'product-1',
      offers: [offer({ id: 'offer-36', monthlyRent: 999_000 })],
    }));

    const stored = await d.applications.get(result.application.id);
    assert.ok(stored);
    const after = applicationSnapshotToCore(stored);
    assert.equal(after.payload_digest, before.payload_digest);
    assert.equal(after.payload.offer.monthlyRent, 690_000);
    assert.equal(after.source_revision, 'product:product-1:v1');
  });
});

describe('AI Core shadow — errors', () => {
  it('maps AppError codes to stable Core machine families', () => {
    const validation = appErrorToCore(
      new AppError('VALIDATION', 'name required', { field: 'applicantName' }),
      'corr-admin-1',
    );
    assert.equal(CORE_ERROR_CONTRACT, 'core-error/v1');
    assert.equal(validation.code, 'VALIDATION_ERROR');
    assert.equal(validation.status, 400);
    assert.equal(validation.category, 'USER');
    assert.equal(validation.retryable, false);
    assert.equal(validation.meta.field, 'applicantName');

    const persistence = appErrorToCore(
      new AppError('PERSISTENCE', 'write failed'),
      'corr-admin-2',
    );
    assert.equal(persistence.code, 'PERSISTENCE_ERROR');
    assert.equal(persistence.status, 500);
    assert.equal(persistence.category, 'SYSTEM');
    assert.equal(persistence.retryable, true);
  });

  it('maps service result reasons without changing domain result types', () => {
    const changed = serviceReasonToCore(
      'PRODUCT_CHANGED',
      'corr-admin-3',
      { currentVersion: 2, seenVersion: 1 },
    );
    assert.equal(changed.code, 'VERSION_MISMATCH');
    assert.equal(changed.status, 409);
    assert.deepEqual(changed.meta, { currentVersion: 2, seenVersion: 1 });

    const cancelled = serviceReasonToCore('CANCELLED', 'corr-admin-4');
    assert.equal(cancelled.code, 'CANCELLED');
    assert.equal(cancelled.retryable, false);

    const reason = serviceReasonToCore('REASON_REQUIRED', 'corr-admin-5');
    assert.equal(reason.code, 'VALIDATION_ERROR');
  });
});
