import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  FileApplicationRepository,
  FilePerformanceRepository,
  FileProductRepository,
  FileSettlementRepository,
} from '../../adapters/store/repositories';
import { settlementTotals } from '../../domain/settlement/types';
import { offer, product } from '../../domain/search/__tests__/fixtures';
import { markProgress, submitApplication, type Deps as ApplicationDeps } from '../applications';
import { ensureNormalPerformance, type PerformanceDeps } from '../performances';
import {
  addSettlementAdjustment,
  ensureSettlement,
  markClaimIssued,
  markCollected,
  markPayoutPaid,
  type SettlementDeps,
} from '../settlements';

let root: string;
let seq = 0;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'fpa-settlement-'));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

async function delivered(box: string) {
  const dir = join(root, box);
  const applications = new FileApplicationRepository(dir);
  const products = new FileProductRepository(dir);
  const performances = new FilePerformanceRepository(dir);
  const settlements = new FileSettlementRepository(dir);

  const appDeps: ApplicationDeps = {
    products,
    applications,
    now: () => new Date('2026-09-20T10:00:00.000Z'),
    newId: () => `app-${++seq}`,
    actors: { requireActor: async () => ({ id: 'staff-park', type: 'ADMIN' as const }) },
  };
  const performanceDeps: PerformanceDeps = {
    applications,
    performances,
    now: () => new Date('2026-09-20T10:05:00.000Z'),
    newId: () => `perf-${++seq}`,
    newSettlementCode: () => `stl-${++seq}`,
  };

  await products.save(product({
    id: 'product-1',
    registration: { vehicleNumber: '123하4567' },
    offers: [offer({ id: 'offer-36', monthlyRent: 920_000 })],
  }));

  const submitted = await submitApplication(appDeps, {
    productId: 'product-1',
    offerId: 'offer-36',
    salesChannelId: 'channel-1',
    assigneeId: 'staff-park',
    applicantName: '김서연',
    expectedProductVersion: 1,
    submissionId: `sub-${box}`,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) throw new Error('submit failed');

  await markProgress(appDeps, submitted.application.id, 'deliveryCompleted', true);
  const performance = await ensureNormalPerformance(performanceDeps, submitted.application.id);
  assert.equal(performance.ok, true);
  if (!performance.ok) throw new Error('performance failed');

  return { dir, applications, products, performances, settlements, performance: performance.performance };
}

describe('실적 → 정산', () => {
  it('실적 하나에는 정산 하나만 생긴다', async () => {
    const d = await delivered('one-settlement');
    const deps: SettlementDeps = {
      performances: d.performances,
      settlements: d.settlements,
      rules: {
        quote: async () => ({
          state: 'READY' as const,
          claim: { supplyAmount: 1_000_000, vatAmount: 100_000, totalAmount: 1_100_000 },
          payout: { supplyAmount: 800_000, vatAmount: 80_000, totalAmount: 880_000 },
          rule: {
            ruleId: 'legacy-f04-test',
            ruleVersion: '1',
            sourceRevision: 'test-revision',
            auto: true,
            explanation: 'test quote',
          },
        }),
      },
      now: () => new Date('2026-09-20T11:00:00.000Z'),
      newId: () => `settlement-${++seq}`,
      newAdjustmentId: () => `adjustment-${++seq}`,
    };

    const [a, b] = await Promise.all([
      ensureSettlement(deps, d.performance.id),
      ensureSettlement(deps, d.performance.id),
    ]);

    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal((await d.settlements.list()).length, 1);
    const rows = await d.settlements.list();
    assert.equal(rows[0].settlementCode, d.performance.settlementCode);
    assert.equal(rows[0].performanceId, d.performance.id);
  });

  it('청구·수금·지급은 한 상태값이 아니라 각각 사실로 남는다', async () => {
    const d = await delivered('money-facts');
    const deps: SettlementDeps = {
      performances: d.performances,
      settlements: d.settlements,
      rules: {
        quote: async () => ({
          state: 'READY' as const,
          claim: { supplyAmount: 1_000_000, vatAmount: 100_000, totalAmount: 1_100_000 },
          payout: { supplyAmount: 800_000, vatAmount: 80_000, totalAmount: 880_000 },
          rule: {
            ruleId: 'rule-1',
            ruleVersion: '2026-09',
            sourceRevision: 'abc123',
            auto: true,
            explanation: '자동 계산',
          },
        }),
      },
      now: () => new Date('2026-09-20T11:00:00.000Z'),
      newId: () => `settlement-${++seq}`,
      newAdjustmentId: () => `adjustment-${++seq}`,
    };

    const created = await ensureSettlement(deps, d.performance.id);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const issued = await markClaimIssued(deps, created.settlement.id);
    assert.ok(issued.claimIssuedAt);
    assert.equal(issued.collectedAt, undefined);
    assert.equal(issued.payoutPaidAt, undefined);

    const collected = await markCollected(deps, created.settlement.id);
    assert.ok(collected.collectedAt);
    assert.equal(collected.payoutPaidAt, undefined);

    const paid = await markPayoutPaid(deps, created.settlement.id);
    assert.ok(paid.payoutPaidAt);
  });

  it('가감은 기본금액을 덮지 않고 이력으로 추가한다', async () => {
    const d = await delivered('adjustment');
    const deps: SettlementDeps = {
      performances: d.performances,
      settlements: d.settlements,
      rules: {
        quote: async () => ({
          state: 'READY' as const,
          claim: { supplyAmount: 1_000_000, vatAmount: 100_000, totalAmount: 1_100_000 },
          payout: { supplyAmount: 800_000, vatAmount: 80_000, totalAmount: 880_000 },
          rule: {
            ruleId: 'rule-1',
            ruleVersion: '2026-09',
            sourceRevision: 'abc123',
            auto: true,
            explanation: '자동 계산',
          },
        }),
      },
      now: () => new Date('2026-09-20T11:00:00.000Z'),
      newId: () => `settlement-${++seq}`,
      newAdjustmentId: () => `adjustment-${++seq}`,
    };

    const created = await ensureSettlement(deps, d.performance.id);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const adjusted = await addSettlementAdjustment(deps, created.settlement.id, {
      side: 'CLAIM',
      amount: -100_000,
      reason: '공급사 협의 차감',
      actorId: 'staff-park',
    });

    assert.equal(adjusted.calculation.state, 'READY');
    if (adjusted.calculation.state !== 'READY') return;
    assert.equal(adjusted.calculation.claim.totalAmount, 1_100_000, '기본 청구액은 안 바뀐다');
    assert.equal(adjusted.adjustments.length, 1);
    assert.deepEqual(settlementTotals(adjusted), {
      claimTotal: 1_000_000,
      payoutTotal: 880_000,
      margin: 120_000,
    });
  });

  it('자동계산 불가 건은 검토 전 청구 사실로 진행시키지 않는다', async () => {
    const d = await delivered('review-required');
    const deps: SettlementDeps = {
      performances: d.performances,
      settlements: d.settlements,
      rules: {
        quote: async () => ({
          state: 'REVIEW_REQUIRED' as const,
          rule: {
            ruleId: 'matching-max-rate',
            ruleVersion: '2026-09',
            sourceRevision: 'abc123',
            auto: false,
            explanation: '최대 9% — 영업자 조율',
          },
          reason: '한 값으로 확정할 수 없음',
        }),
      },
      now: () => new Date('2026-09-20T11:00:00.000Z'),
      newId: () => `settlement-${++seq}`,
      newAdjustmentId: () => `adjustment-${++seq}`,
    };

    const created = await ensureSettlement(deps, d.performance.id);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.settlement.calculation.state, 'REVIEW_REQUIRED');

    await assert.rejects(
      () => markClaimIssued(deps, created.settlement.id),
      /manual review/,
    );
  });
});
