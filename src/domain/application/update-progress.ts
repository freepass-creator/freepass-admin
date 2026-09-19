import { AppError } from '../errors';
import { assertActor, type ActorRef } from '../security/actor';
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
  actor: ActorRef,
): Application {
  if (application.status === 'CANCELLED') {
    throw new AppError('CANCELLED', 'Cancelled applications cannot change progress.');
  }

  const before = application.progress[key];
  if (before === completed) return application;

  const progress = { ...application.progress, [key]: completed };
  const safeActor = assertActor(actor);

  return {
    ...application,
    progress,
    status: deriveStatus(application, progress),
    history: [
      ...application.history,
      {
        type: 'APPLICATION_PROGRESS_CHANGED',
        occurredAt: now,
        actor: safeActor,
        key,
        from: before,
        to: completed,
      },
    ],
    updatedAt: now,
  };
}

export function cancelApplication(
  application: Application,
  reason: string,
  now: string,
  actor: ActorRef,
): Application {
  if (!reason.trim()) throw new AppError('VALIDATION', 'Cancellation reason is required.');
  if (application.status === 'CANCELLED') return application;
  const safeActor = assertActor(actor);
  return {
    ...application,
    status: 'CANCELLED',
    cancellationReason: reason.trim(),
    cancelledAt: now,
    history: [
      ...application.history,
      {
        type: 'APPLICATION_CANCELLED',
        occurredAt: now,
        actor: safeActor,
        reason: reason.trim(),
      },
    ],
    updatedAt: now,
  };
}
