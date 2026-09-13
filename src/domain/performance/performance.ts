import type { Application } from '../application/types';
import type { PolicyValue } from '../product/types';
import type { Performance, SettlementAmounts } from './types';

function clonePolicy<T extends PolicyValue>(policy: T): T {
  return {
    ...policy,
    value: Array.isArray(policy.value) ? [...policy.value] : policy.value,
  } as T;
}

export function createPerformanceFromDelivery(
  application: Application,
  id: string,
  deliveredAt = application.deliveredAt ?? '',
): Performance {
  if (application.status !== 'DELIVERED' || !application.progress.deliveryCompleted) {
    throw new Error('Only a delivered application can create a performance.');
  }
  if (!application.deliveryEventId || !deliveredAt) {
    throw new Error('Delivery event facts are required to create a performance.');
  }
  if (id !== `performance:${application.id}`) {
    throw new Error('Performance id must be derived from application id.');
  }

  return {
    id,
    applicationId: application.id,
    deliveryEventId: application.deliveryEventId,
    status: 'AWAITING_AMOUNTS',
    snapshot: {
      applicationNumber: application.applicationNumber,
      customerName: application.customerName,
      supplierId: application.snapshot.supplierId,
      salesChannelId: application.salesChannelId,
      assigneeId: application.assigneeId,
      productId: application.snapshot.productId,
      productVersion: application.snapshot.productVersion,
      vehicleLabel: application.snapshot.vehicleLabel,
      vehicle: { ...application.snapshot.vehicle },
      registration: application.snapshot.registration ? { ...application.snapshot.registration } : undefined,
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

function assertMoney(value: number | null, label: string) {
  if (value === null || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function assertRecordedDecision(partyId: string, recordedByAdminId: string) {
  if (!partyId.trim()) throw new Error('Decision party id is required.');
  if (!recordedByAdminId.trim()) throw new Error('Recording admin id is required.');
}

export function setSettlementAmounts(
  performance: Performance,
  amounts: SettlementAmounts,
  now: string,
): Performance {
  if (performance.status === 'FINALIZED') throw new Error('Finalized performance is immutable.');
  if (performance.status !== 'AWAITING_AMOUNTS' && performance.status !== 'AWAITING_SALESPERSON_CONFIRMATION') {
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
    updatedAt: now,
  };
}

export function confirmBySalesperson(
  performance: Performance,
  confirmedPartyId: string,
  recordedByAdminId: string,
  now: string,
): Performance {
  assertRecordedDecision(confirmedPartyId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SALESPERSON_CONFIRMATION') {
    throw new Error('Salesperson confirmation is not available in the current state.');
  }
  return {
    ...performance,
    salespersonReview: { status: 'CONFIRMED', partyId: confirmedPartyId, recordedByAdminId, decidedAt: now },
    status: 'AWAITING_SUPPLIER_REVIEW',
    updatedAt: now,
  };
}

export function disputeBySalesperson(
  performance: Performance,
  confirmedPartyId: string,
  recordedByAdminId: string,
  reason: string,
  now: string,
): Performance {
  assertRecordedDecision(confirmedPartyId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SALESPERSON_CONFIRMATION') {
    throw new Error('Salesperson dispute is not available in the current state.');
  }
  if (!reason.trim()) throw new Error('Dispute reason is required.');
  return {
    ...performance,
    salespersonReview: { status: 'DISPUTED', partyId: confirmedPartyId, recordedByAdminId, decidedAt: now, reason: reason.trim() },
    status: 'AWAITING_SUPPLIER_REVIEW',
    updatedAt: now,
  };
}

export function confirmBySupplier(
  performance: Performance,
  supplierId: string,
  recordedByAdminId: string,
  now: string,
): Performance {
  assertRecordedDecision(supplierId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SUPPLIER_REVIEW') {
    throw new Error('Supplier review must follow salesperson confirmation.');
  }
  return {
    ...performance,
    supplierReview: { status: 'CONFIRMED', partyId: supplierId, recordedByAdminId, decidedAt: now },
    reconfirmation: { status: 'NOT_REQUIRED' },
    status: performance.salespersonReview.status === 'DISPUTED' ? 'SUPPLIER_ISSUE' : 'READY_TO_FINALIZE',
    updatedAt: now,
  };
}

export function registerSupplierIssue(
  performance: Performance,
  supplierId: string,
  recordedByAdminId: string,
  reason: string,
  proposedAmounts: SettlementAmounts,
  now: string,
): Performance {
  assertRecordedDecision(supplierId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SUPPLIER_REVIEW') {
    throw new Error('Supplier issue must follow salesperson confirmation.');
  }
  if (!reason.trim()) throw new Error('Supplier issue reason is required.');
  assertMoney(proposedAmounts.supplierReceivable, 'Supplier receivable');
  assertMoney(proposedAmounts.channelPayable, 'Channel payable');
  if (proposedAmounts.vatMode === 'UNDECIDED') throw new Error('VAT mode must be decided.');
  const affectsChannelPayable = proposedAmounts.channelPayable !== performance.amounts.channelPayable;
  return {
    ...performance,
    amounts: { ...proposedAmounts },
    supplierReview: {
      status: 'DISPUTED',
      partyId: supplierId,
      recordedByAdminId,
      decidedAt: now,
      reason: reason.trim(),
      affectsChannelPayable,
    },
    reconfirmation: affectsChannelPayable ? { status: 'PENDING' } : { status: 'NOT_REQUIRED' },
    status: affectsChannelPayable ? 'AWAITING_SALESPERSON_RECONFIRMATION' : 'SUPPLIER_ISSUE',
    updatedAt: now,
  };
}

export function resolveOpenIssue(
  performance: Performance,
  recordedByAdminId: string,
  reason: string,
  now: string,
): Performance {
  if (!recordedByAdminId.trim()) throw new Error('Recording admin id is required.');
  if (performance.status !== 'SUPPLIER_ISSUE') throw new Error('There is no open issue to resolve.');
  if (!reason.trim()) throw new Error('Resolution reason is required.');
  return {
    ...performance,
    resolution: { recordedByAdminId, reason: reason.trim(), resolvedAt: now },
    status: 'READY_TO_FINALIZE',
    updatedAt: now,
  };
}

export function acceptSupplierIssue(
  performance: Performance,
  confirmedPartyId: string,
  recordedByAdminId: string,
  now: string,
): Performance {
  assertRecordedDecision(confirmedPartyId, recordedByAdminId);
  if (performance.status !== 'AWAITING_SALESPERSON_RECONFIRMATION') {
    throw new Error('There is no supplier issue awaiting salesperson reconfirmation.');
  }
  return {
    ...performance,
    reconfirmation: { status: 'ACCEPTED', partyId: confirmedPartyId, recordedByAdminId, decidedAt: now },
    status: 'READY_TO_FINALIZE',
    updatedAt: now,
  };
}

export function markPerformanceFinalized(performance: Performance, now: string): Performance {
  if (performance.status !== 'READY_TO_FINALIZE') {
    throw new Error('Only a reviewed performance can be finalized.');
  }
  return { ...performance, status: 'FINALIZED', finalizedAt: now, updatedAt: now };
}
