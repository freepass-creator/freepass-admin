import type { Application, ApplicationProgress, ApplicationStatus } from './types';

export type ProgressKey = keyof ApplicationProgress;

function deriveStatus(application: Application, progress: ApplicationProgress): ApplicationStatus {
  if (application.status === 'CANCELLED') return 'CANCELLED';
  if (progress.deliveryCompleted) return 'DELIVERED';
  if (progress.contractCompleted) return 'CONTRACTED';
  return 'RECEIVED';
}

export function updateApplicationProgress(
  application: Application,
  key: ProgressKey,
  completed: boolean,
  now: string,
  deliveryEventId?: string,
): Application {
  if (application.status === 'CANCELLED') {
    throw new Error('Cancelled applications cannot change progress.');
  }
  if (key === 'deliveryCompleted' && application.progress.deliveryCompleted) {
    if (completed && deliveryEventId === application.deliveryEventId) return application;
    throw new Error('Delivered applications require an adjustment instead of changing delivery facts.');
  }
  if (key === 'deliveryCompleted' && completed && !deliveryEventId?.trim()) {
    throw new Error('Delivery event id is required.');
  }

  const progress = { ...application.progress, [key]: completed };

  return {
    ...application,
    progress,
    status: deriveStatus(application, progress),
    ...(key === 'deliveryCompleted' && completed
      ? { deliveryEventId, deliveredAt: now }
      : {}),
    updatedAt: now,
  };
}

export function cancelApplication(
  application: Application,
  reason: string,
  now: string,
): Application {
  if (application.status === 'CANCELLED') throw new Error('Application is already cancelled.');
  if (application.status === 'DELIVERED') throw new Error('Delivered applications require a settlement adjustment instead of cancellation.');
  if (!reason.trim()) throw new Error('Cancellation reason is required.');
  return {
    ...application,
    status: 'CANCELLED',
    cancellationReason: reason.trim(),
    cancelledAt: now,
    updatedAt: now,
  };
}
