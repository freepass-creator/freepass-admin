import type { Application } from '../application/types';
import type { PolicyValue } from '../product/types';
import type { Performance, SettlementAmounts } from './types';

function clonePolicy<T extends PolicyValue>(policy: T): T {
  return {
    ...policy,
    value: Array.isArray(policy.value) ? [...policy.value] : policy.value,
  } as T;
}

function deliveryEvidenceAt(application: Application): string | null {
  const event = [...application.history].reverse().find((item) =>
    item.type === 'APPLICATION_PROGRESS_CHANGED'
    && item.key === 'deliveryCompleted'
    && item.to === true,
  );
  return event?.occurredAt ?? null;
}

function assertMoney(value: number | null, label: string) {
  if (value === null || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function assertDecisionActors(partyId: string, recordedByAdminId: string) {
  if (!partyId.trim()) throw new Error('Decision party id is required.');
  if (!recordedByAdminId.trim()) throw new Error('Recording admin id is required.');
}

export function createPerformanceFromDelivery(application: Application): Performance {
  if (application.status !== 'DELIVERED' || !application.progress.deliveryCompleted) {
    throw new Error('Only a delivered application can create a performance.');
  }
  const deliveredAt = deliveryEvidenceAt(application);
  if (!deliveredAt) {
    throw new Error('Delivery completion evidence is required to create a performance.');
  }

  return {
    id: `performance:${application.id}`,
    applicationId: application.id,
    deliveryEvidenceAt: deliveredAt,
    status: 'AWAITING_AMOUNTS',
    snapshot: {
      applicationNumber: application.applicationNumber,
      applicantName: application.applicantName,
      supplierId: application.snapshot.supplierId,
      salesChannelId: application.salesChannelId,
      assigneeId: application.assigneeId,
      productId: application.snapshot.productId,
      productVersion: application.snapshot.productVersion,
      vehicle: { ...application.snapshot.vehicle },
      specs: { ...application.snapshot.specs },
      offer: {
        ...application.snapshot.offer,
        policyValues: application.snapshot.offer.policyValues.map(clonePolicy),
      },
      policies: application.snapshot.productPolicies.map(clonePolicy),
      deliveredAt,
    },
    amounts: {
      supplierReceivable: null,
      channelPayable: null,
      vatMode: 'UNDECIDED',
    },
    salespersonReview: { status: 'PENDING' },
    supplierReview: { status: 'PENDING' },
    reconfirmation: { status: 'NOT_REQUIRED' },
    createdAt: deliveredAt,
    updatedAt: deliveredAt,
  };
}

export function setSettlementAmounts(
  performance: Performance,
  amounts: SettlementAmounts,
  now: string,
): Performance {
  if (performance.status === 'FINALIZED') throw new Error('Finalized performance is immutable.');
  if (!['AWAITING_AMOUNTS', 'AWAITING_SALESPERSON_CONFIRMATION'].includes(performance.status)) {
    throw new Error('Reviewed amounts require a separate revision workflow.');
  }
  assertMoney(amounts.supplierReceivable, 'Supplier receivable');
  assertMoney(amounts.channelPayable, 'Channel payable');
  if (amounts.vatMode === 'UNDECIDED') throw new Error('VAT mode must be decided.');

  return {
    ...performance,
    amounts: { ...amounts },
    status: 'AWAITING_SALESPERSON_CONFIRMATION',
    salespersonReview: { status: 'PENDING' },
    supplierReview: { status: 'PENDING' },
    reconfirmation: { status: 'NOT_REQUIRED' },
    resolution: undefined,
    updatedAt: now,
  };
}

export function confirmBySalesperson(
  performance: Performance,
  partyId: string,
  recordedByAdminId: string,
  now: string,
): Performance {
  assertDecisionActors(partyId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SALESPERSON_CONFIRMATION') {
    throw new Error('Salesperson confirmation is not available in the current state.');
  }
  return {
    ...performance,
    salespersonReview: { status: 'CONFIRMED', partyId, recordedByAdminId, decidedAt: now },
    status: 'AWAITING_SUPPLIER_REVIEW',
    updatedAt: now,
  };
}

export function disputeBySalesperson(
  performance: Performance,
  partyId: string,
  recordedByAdminId: string,
  reason: string,
  now: string,
): Performance {
  assertDecisionActors(partyId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SALESPERSON_CONFIRMATION') {
    throw new Error('Salesperson dispute is not available in the current state.');
  }
  if (!reason.trim()) throw new Error('Dispute reason is required.');
  return {
    ...performance,
    salespersonReview: { status: 'DISPUTED', partyId, recordedByAdminId, decidedAt: now, reason: reason.trim() },
    status: 'AWAITING_SUPPLIER_REVIEW',
    updatedAt: now,
  };
}

export function confirmBySupplier(
  performance: Performance,
  supplierPartyId: string,
  recordedByAdminId: string,
  now: string,
): Performance {
  assertDecisionActors(supplierPartyId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SUPPLIER_REVIEW') {
    throw new Error('Supplier review must follow salesperson review.');
  }
  return {
    ...performance,
    supplierReview: { status: 'CONFIRMED', partyId: supplierPartyId, recordedByAdminId, decidedAt: now },
    status: performance.salespersonReview.status === 'DISPUTED' ? 'SUPPLIER_ISSUE' : 'READY_TO_FINALIZE',
    updatedAt: now,
  };
}

export function registerSupplierIssue(
  performance: Performance,
  supplierPartyId: string,
  recordedByAdminId: string,
  reason: string,
  proposedAmounts: SettlementAmounts,
  now: string,
): Performance {
  assertDecisionActors(supplierPartyId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SUPPLIER_REVIEW') {
    throw new Error('Supplier issue must follow salesperson review.');
  }
  if (!reason.trim()) throw new Error('Supplier issue reason is required.');
  assertMoney(proposedAmounts.supplierReceivable, 'Supplier receivable');
  assertMoney(proposedAmounts.channelPayable, 'Channel payable');
  if (proposedAmounts.vatMode === 'UNDECIDED') throw new Error('VAT mode must be decided.');

  const channelChanged = proposedAmounts.channelPayable !== performance.amounts.channelPayable;
  return {
    ...performance,
    amounts: { ...proposedAmounts },
    supplierReview: {
      status: 'DISPUTED',
      partyId: supplierPartyId,
      recordedByAdminId,
      decidedAt: now,
      reason: reason.trim(),
    },
    reconfirmation: channelChanged
      ? { status: 'REQUIRED', reason: 'Supplier changed channel payable amount.' }
      : { status: 'NOT_REQUIRED' },
    status: channelChanged ? 'AWAITING_SALESPERSON_RECONFIRMATION' : 'SUPPLIER_ISSUE',
    updatedAt: now,
  };
}

export function reconfirmBySalesperson(
  performance: Performance,
  partyId: string,
  recordedByAdminId: string,
  now: string,
): Performance {
  assertDecisionActors(partyId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SALESPERSON_RECONFIRMATION') {
    throw new Error('Salesperson reconfirmation is not available in the current state.');
  }
  return {
    ...performance,
    salespersonReview: { status: 'CONFIRMED', partyId, recordedByAdminId, decidedAt: now },
    reconfirmation: { status: 'CONFIRMED', partyId, recordedByAdminId, decidedAt: now },
    status: 'READY_TO_FINALIZE',
    updatedAt: now,
  };
}

export function resolveOpenIssue(
  performance: Performance,
  recordedByAdminId: string,
  reason: string,
  now: string,
): Performance {
  if (performance.status !== 'SUPPLIER_ISSUE') throw new Error('There is no open supplier issue.');
  if (!recordedByAdminId.trim()) throw new Error('Recording admin id is required.');
  if (!reason.trim()) throw new Error('Resolution reason is required.');
  return {
    ...performance,
    resolution: { recordedByAdminId, reason: reason.trim(), resolvedAt: now },
    status: 'READY_TO_FINALIZE',
    updatedAt: now,
  };
}

export function markPerformanceFinalized(performance: Performance, now: string): Performance {
  if (performance.status !== 'READY_TO_FINALIZE') {
    throw new Error('Performance review is not complete.');
  }
  return { ...performance, status: 'FINALIZED', updatedAt: now };
}
