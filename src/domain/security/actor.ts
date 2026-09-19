export type ActorType = 'ADMIN' | 'SALES' | 'WHITE_LABEL' | 'SYSTEM';

export interface ActorRef {
  id: string;
  type: ActorType;
}

export function assertActor(actor: ActorRef): ActorRef {
  if (!actor.id.trim()) throw new Error('Actor id is required.');
  return { ...actor, id: actor.id.trim() };
}
