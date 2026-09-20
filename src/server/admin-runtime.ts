import { FileApplicationRepository, FileProductRepository } from '../adapters/store/repositories';
import type { ActorProvider } from '../ports/auth';
import type { ApplicationRepository, ProductRepository } from '../ports/repositories';

export type AdminRuntimeMode = 'FILE_DEV' | 'UNBOUND_PRODUCTION';

export function adminRuntimeMode(env: NodeJS.ProcessEnv = process.env): AdminRuntimeMode {
  return env.NODE_ENV === 'production' ? 'UNBOUND_PRODUCTION' : 'FILE_DEV';
}

export function adminRepositories(env: NodeJS.ProcessEnv = process.env): {
  products: ProductRepository;
  applications: ApplicationRepository;
} {
  if (adminRuntimeMode(env) === 'UNBOUND_PRODUCTION') {
    throw new Error(
      'ADMIN_PRODUCTION_PERSISTENCE_ADAPTER_NOT_BOUND: approved Firestore adapter is not connected yet.',
    );
  }
  return {
    products: new FileProductRepository(env.FPA_DATA_DIR),
    applications: new FileApplicationRepository(env.FPA_DATA_DIR),
  };
}

export function adminActorProvider(env: NodeJS.ProcessEnv = process.env): ActorProvider {
  if (adminRuntimeMode(env) === 'UNBOUND_PRODUCTION') {
    throw new Error(
      'ADMIN_PRODUCTION_ACTOR_ADAPTER_NOT_BOUND: approved production authentication adapter is not connected yet.',
    );
  }
  const id = String(env.FPA_DEV_ACTOR_ID || 'dev-admin').trim();
  if (!id) throw new Error('FPA_DEV_ACTOR_ID must not be empty.');
  return {
    requireActor: async () => ({ id, type: 'ADMIN' as const }),
  };
}
