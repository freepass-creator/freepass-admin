import type { Performance } from '../performance/types';

export interface MoneyBreakdown {
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export interface SettlementRuleRef {
  ruleId: string;
  ruleVersion: string;
  sourceRevision: string;
  /** 기계가 한 값으로 확정했는지. false면 관리자 검토가 필요하다. */
  auto: boolean;
  explanation: string;
}

export type SettlementCalculation =
  | {
      state: 'READY';
      claim: MoneyBreakdown;
      payout: MoneyBreakdown;
      rule: SettlementRuleRef;
    }
  | {
      state: 'REVIEW_REQUIRED';
      rule: SettlementRuleRef;
      reason: string;
    };

export interface SettlementAdjustment {
  id: string;
  side: 'CLAIM' | 'PAYOUT';
  /** +면 더하고 -면 뺀다. 원금액을 덮어쓰지 않는다. */
  amount: number;
  reason: string;
  actorId: string;
  occurredAt: string;
}

export interface Settlement {
  id: string;
  /** Performance가 가진 안정키를 그대로 쓴다. */
  settlementCode: string;
  performanceId: string;
  performanceNumber: string;
  applicationId: string;

  calculation: SettlementCalculation;
  adjustments: SettlementAdjustment[];

  /** 상태 하나로 뭉개지 않고 실제 사실을 따로 보존한다. */
  claimIssuedAt?: string;
  collectedAt?: string;
  payoutPaidAt?: string;

  createdAt: string;
  updatedAt: string;
}

export type SettlementQuote = SettlementCalculation;

export function settlementTotals(settlement: Settlement): {
  claimTotal: number | null;
  payoutTotal: number | null;
  margin: number | null;
} {
  if (settlement.calculation.state !== 'READY') {
    return { claimTotal: null, payoutTotal: null, margin: null };
  }

  const claimAdjustment = settlement.adjustments
    .filter((row) => row.side === 'CLAIM')
    .reduce((sum, row) => sum + row.amount, 0);
  const payoutAdjustment = settlement.adjustments
    .filter((row) => row.side === 'PAYOUT')
    .reduce((sum, row) => sum + row.amount, 0);

  const claimTotal = settlement.calculation.claim.totalAmount + claimAdjustment;
  const payoutTotal = settlement.calculation.payout.totalAmount + payoutAdjustment;
  return { claimTotal, payoutTotal, margin: claimTotal - payoutTotal };
}

/** Rule Provider가 계산할 때 필요한 입력은 Performance 하나로 닫는다. */
export type SettlementPerformance = Performance;
