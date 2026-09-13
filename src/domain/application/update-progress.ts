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
): Application {
  if (application.status === 'CANCELLED') {
    throw new Error('Cancelled applications cannot change progress.');
  }

  const progress = { ...application.progress, [key]: completed };

  return {
    ...application,
    progress,
    status: deriveStatus(application, progress),
    updatedAt: now,
  };
}

export function cancelApplication(
  application: Application,
  reason: string,
  now: string,
): Application {
  if (!reason.trim()) throw new Error('Cancellation reason is required.');
  return {
    ...application,
    status: 'CANCELLED',
    cancellationReason: reason.trim(),
    cancelledAt: now,
    updatedAt: now,
  };
}
