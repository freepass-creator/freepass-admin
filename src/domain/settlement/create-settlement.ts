import type { Performance } from '../performance/types';
import type { Settlement, SettlementCalculation } from './types';

export interface CreateSettlementInput {
  id: string;
  performance: Performance;
  calculation: SettlementCalculation;
  now: string;
}

export function createSettlement(input: CreateSettlementInput): Settlement {
  return {
    id: input.id,
    settlementCode: input.performance.settlementCode,
    performanceId: input.performance.id,
    performanceNumber: input.performance.performanceNumber,
    applicationId: input.performance.applicationId,
    calculation: input.calculation,
    adjustments: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
}
