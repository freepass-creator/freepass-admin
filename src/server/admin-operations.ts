import { FileOperationsRepository } from '../adapters/store/operations-repository';
import type { OperationsRepository } from '../ports/operations';
import { adminRuntimeMode } from './admin-runtime';

export function adminOperations(env: NodeJS.ProcessEnv = process.env): OperationsRepository {
  if (adminRuntimeMode(env) === 'UNBOUND_PRODUCTION') {
    throw new Error(
      'ADMIN_PRODUCTION_OPERATIONS_ADAPTER_NOT_BOUND: approved Firestore settlement transaction adapter is not connected yet.',
    );
  }
  return new FileOperationsRepository(env.FPA_DATA_DIR);
}
