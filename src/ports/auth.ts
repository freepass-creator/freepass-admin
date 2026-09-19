import type { ActorRef } from '../domain/security/actor';

/**
 * 인증 구현과 Domain/Service 사이의 문.
 *
 * Service는 cookie/Firebase/session 형식을 직접 알지 않는다.
 * 운영 Adapter는 인증된 현재 사용자를 ActorRef로 변환하고,
 * 인증이 없거나 무효하면 여기서 fail-closed 해야 한다.
 */
export interface ActorProvider {
  requireActor(): Promise<ActorRef>;
}
