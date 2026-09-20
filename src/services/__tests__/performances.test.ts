import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  FileApplicationRepository,
  FilePerformanceRepository,
  FileProductRepository,
} from '../../adapters/store/repositories';
import { offer, product } from '../../domain/search/__tests__/fixtures';
import { markProgress, submitApplication, type Deps as ApplicationDeps } from '../applications';
import { ensureNormalPerformance, type PerformanceDeps } from '../performances';

let root: string;
let idSeq = 0;
let settlementSeq = 0;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'fpa-performance-'));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

function deps(box: string): { app: ApplicationDeps; perf: PerformanceDeps } {
  const dir = join(root, box);
  const applications = new FileApplicationRepository(dir);
  return {
    app: {
      products: new FileProductRepository(dir),
      applications,
      now: () => new Date('2026-09-20T10:00:00.000Z'),
      newId: () => `app-${++idSeq}`,
      actors: {
        requireActor: async () => ({ id: 'staff-park', type: 'ADMIN' as const }),
      },
    },
    perf: {
      applications,
      performances: new FilePerformanceRepository(dir),
      now: () => new Date('2026-09-20T10:05:00.000Z'),
      newId: () => `perf-${++idSeq}`,
      newSettlementCode: () => `stl-test-${++settlementSeq}`,
    },
  };
}

describe('인도 → 정상실적', () => {
  it('인도 전에는 실적을 만들지 않는다', async () => {
    const d = deps('not-delivered');
    await d.app.products.save(product({
      id: 'product-1',
      registration: { vehicleNumber: '123하4567' },
      offers: [offer({ id: 'offer-36' })],
    }));

    const submitted = await submitApplication(d.app, {
      productId: 'product-1',
      offerId: 'offer-36',
      salesChannelId: 'channel-1',
      assigneeId: 'staff-park',
      applicantName: '김서연',
      expectedProductVersion: 1,
      submissionId: 'sub-not-delivered',
    });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;

    const result = await ensureNormalPerformance(d.perf, submitted.application.id);
    assert.deepEqual(result, { ok: false, reason: 'NOT_DELIVERED' });
    assert.equal((await d.perf.performances.list()).length, 0);
  });

  it('인도가 찍히면 Snapshot 그대로 NORMAL 실적 한 건을 만든다', async () => {
    const d = deps('delivered');
    await d.app.products.save(product({
      id: 'product-1',
      registration: { vehicleNumber: '123하4567', vin: 'KMH-TEST-VIN' },
      offers: [offer({ id: 'offer-36', monthlyRent: 920_000, deposit: 0 })],
    }));

    const submitted = await submitApplication(d.app, {
      productId: 'product-1',
      offerId: 'offer-36',
      salesChannelId: 'channel-1',
      assigneeId: 'staff-park',
      applicantName: '김서연',
      expectedProductVersion: 1,
      submissionId: 'sub-delivered',
    });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;

    const delivered = await markProgress(d.app, submitted.application.id, 'deliveryCompleted', true);
    assert.equal(delivered.ok, true);

    const first = await ensureNormalPerformance(d.perf, submitted.application.id);
    assert.equal(first.ok, true);
    if (!first.ok) return;

    assert.equal(first.created, true);
    assert.equal(first.performance.kind, 'NORMAL');
    assert.equal(first.performance.performanceNumber, 'P-260920-001');
    assert.equal(first.performance.snapshot.registration?.vehicleNumber, '123하4567');
    assert.equal(first.performance.snapshot.offer.monthlyRent, 920_000);
    assert.equal(first.performance.applicationId, submitted.application.id);
    assert.equal(first.performance.occurredAt, '2026-09-20T10:00:00.000Z');
  });

  it('같은 applicationId로 동시에 재시도해도 NORMAL 실적은 하나다', async () => {
    const d = deps('idempotent');
    await d.app.products.save(product({
      id: 'product-1',
      registration: { vehicleNumber: '99호9999' },
      offers: [offer({ id: 'offer-36' })],
    }));

    const submitted = await submitApplication(d.app, {
      productId: 'product-1',
      offerId: 'offer-36',
      salesChannelId: 'channel-1',
      assigneeId: 'staff-park',
      applicantName: '이서진',
      expectedProductVersion: 1,
      submissionId: 'sub-idempotent',
    });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;

    await markProgress(d.app, submitted.application.id, 'deliveryCompleted', true);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => ensureNormalPerformance(d.perf, submitted.application.id)),
    );

    assert.equal(results.filter((result) => result.ok && result.created).length, 1);
    assert.equal((await d.perf.performances.list()).length, 1);
  });
});
