import { AppError } from '../errors';

export type ActorType = 'ADMIN' | 'SALES' | 'WHITE_LABEL' | 'SYSTEM';

export interface ActorRef {
  id: string;
  type: ActorType;
}

export function assertActor(actor: ActorRef): ActorRef {
  if (!actor.id.trim()) throw new AppError('VALIDATION', 'Actor id is required.');
  return { ...actor, id: actor.id.trim() };
}
