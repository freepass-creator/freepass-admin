import type { PerformanceStatus } from './types';

export type PerformanceActionAvailability = {
  editAmounts: boolean;
  salesReview: boolean;
  supplierReview: boolean;
  resolveIssue: boolean;
  salesReconfirmation: boolean;
  finalize: boolean;
};

export function getPerformanceActionAvailability(status: PerformanceStatus): PerformanceActionAvailability {
  return {
    editAmounts: status === 'AWAITING_AMOUNTS' || status === 'AWAITING_SALESPERSON_CONFIRMATION',
    salesReview: status === 'AWAITING_SALESPERSON_CONFIRMATION',
    supplierReview: status === 'AWAITING_SUPPLIER_REVIEW',
    resolveIssue: status === 'SUPPLIER_ISSUE',
    salesReconfirmation: status === 'AWAITING_SALESPERSON_RECONFIRMATION',
    finalize: status === 'READY_TO_FINALIZE',
  };
}
