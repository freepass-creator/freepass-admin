import { Erp5OperationsRepository } from '../adapters/erp5/operations-repository';
import { FileOperationsRepository } from '../adapters/store/operations-repository';
import type { OperationsRepository } from '../ports/operations';
import { adminRuntimeMode } from './admin-runtime';

export function adminOperations(env:NodeJS.ProcessEnv=process.env):OperationsRepository{
  const mode=adminRuntimeMode(env);
  if(mode==='ERP5')return new Erp5OperationsRepository();
  if(mode==='UNBOUND_PRODUCTION'){
    throw new Error(
      'ADMIN_PRODUCTION_OPERATIONS_ADAPTER_NOT_BOUND: set FPA_REPOSITORY_MODE=erp5 only with approved ERP5 credentials and namespace.',
    );
  }
  return new FileOperationsRepository(env.FPA_DATA_DIR);
}
