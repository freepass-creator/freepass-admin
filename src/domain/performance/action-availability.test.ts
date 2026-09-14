import assert from 'node:assert/strict';
import test from 'node:test';
import { getPerformanceActionAvailability, type PerformanceActionAvailability } from './action-availability';
import type { PerformanceStatus } from './types';

const none: PerformanceActionAvailability = {
  editAmounts: false,
  salesReview: false,
  supplierReview: false,
  resolveIssue: false,
  salesReconfirmation: false,
  finalize: false,
};

test('performance status exposes only valid workflow actions', () => {
  const expected: Record<PerformanceStatus, PerformanceActionAvailability> = {
    AWAITING_AMOUNTS: { ...none, editAmounts: true },
    AWAITING_SALESPERSON_CONFIRMATION: { ...none, editAmounts: true, salesReview: true },
    AWAITING_SUPPLIER_REVIEW: { ...none, supplierReview: true },
    SUPPLIER_ISSUE: { ...none, resolveIssue: true },
    AWAITING_SALESPERSON_RECONFIRMATION: { ...none, salesReconfirmation: true },
    READY_TO_FINALIZE: { ...none, finalize: true },
    FINALIZED: none,
  };

  for (const [status, actions] of Object.entries(expected)) {
    assert.deepEqual(getPerformanceActionAvailability(status as PerformanceStatus), actions, status);
  }
});
