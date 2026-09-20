import { AppError } from '../domain/errors';
import { createSettlement } from '../domain/settlement/create-settlement';
import type { Settlement, SettlementAdjustment } from '../domain/settlement/types';
import type { PerformanceRepository, SettlementRepository } from '../ports/repositories';
import type { SettlementRuleProvider } from '../ports/settlement';

export interface SettlementDeps {
  performances: PerformanceRepository;
  settlements: SettlementRepository;
  rules: SettlementRuleProvider;
  now: () => Date;
  newId: () => string;
  newAdjustmentId: () => string;
}

export type EnsureSettlementResult =
  | { ok: true; settlement: Settlement; created: boolean }
  | { ok: false; reason: 'PERFORMANCE_NOT_FOUND' | 'UNSUPPORTED_PERFORMANCE' };

export async function ensureSettlement(
  deps: SettlementDeps,
  performanceId: string,
): Promise<EnsureSettlementResult> {
  const performance = await deps.performances.get(performanceId);
  if (!performance) return { ok: false, reason: 'PERFORMANCE_NOT_FOUND' };
  if (performance.kind !== 'NORMAL') return { ok: false, reason: 'UNSUPPORTED_PERFORMANCE' };

  const existing = await deps.settlements.findByPerformanceId(performanceId);
  if (existing) return { ok: true, settlement: existing, created: false };

  const calculation = await deps.rules.quote(performance);
  const now = deps.now().toISOString();
  const stored = await deps.settlements.createForPerformance(
    performance.id,
    () =>
      createSettlement({
        id: deps.newId(),
        performance,
        calculation,
        now,
      }),
  );

  return { ok: true, ...stored };
}

export async function addSettlementAdjustment(
  deps: Pick<SettlementDeps, 'settlements' | 'now' | 'newAdjustmentId'>,
  settlementId: string,
  input: { side: SettlementAdjustment['side']; amount: number; reason: string; actorId: string },
): Promise<Settlement> {
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new AppError('VALIDATION', 'Adjustment amount must be a non-zero finite number.');
  }
  if (!input.reason.trim()) throw new AppError('VALIDATION', 'Adjustment reason is required.');
  if (!input.actorId.trim()) throw new AppError('VALIDATION', 'Adjustment actorId is required.');

  const now = deps.now().toISOString();
  return deps.settlements.mutate(settlementId, (current) => ({
    ...current,
    adjustments: [
      ...current.adjustments,
      {
        id: deps.newAdjustmentId(),
        side: input.side,
        amount: input.amount,
        reason: input.reason.trim(),
        actorId: input.actorId.trim(),
        occurredAt: now,
      },
    ],
    updatedAt: now,
  }));
}

type SettlementFact = 'claimIssuedAt' | 'collectedAt' | 'payoutPaidAt';

async function markFact(
  deps: Pick<SettlementDeps, 'settlements' | 'now'>,
  settlementId: string,
  fact: SettlementFact,
): Promise<Settlement> {
  const existing = await deps.settlements.get(settlementId);
  if (!existing) throw new AppError('NOT_FOUND', `Settlement not found: ${settlementId}`);
  if (existing.calculation.state !== 'READY') {
    throw new AppError('CONFLICT', 'Settlement requires manual review before money facts can advance.');
  }
  if (existing[fact]) return existing;

  const now = deps.now().toISOString();
  return deps.settlements.mutate(settlementId, (current) => ({
    ...current,
    [fact]: current[fact] ?? now,
    updatedAt: now,
  }));
}

export const markClaimIssued = (
  deps: Pick<SettlementDeps, 'settlements' | 'now'>,
  settlementId: string,
) => markFact(deps, settlementId, 'claimIssuedAt');

export const markCollected = (
  deps: Pick<SettlementDeps, 'settlements' | 'now'>,
  settlementId: string,
) => markFact(deps, settlementId, 'collectedAt');

export const markPayoutPaid = (
  deps: Pick<SettlementDeps, 'settlements' | 'now'>,
  settlementId: string,
) => markFact(deps, settlementId, 'payoutPaidAt');
