import { Erp5ReferenceMaster } from '../adapters/erp5/reference-master';
import { EnvReferenceMaster } from '../adapters/store/reference-master';
import type { ReferenceMaster } from '../domain/reference-master/types';
import { adminRuntimeMode } from './admin-runtime';

export function adminReferenceMaster(env:NodeJS.ProcessEnv=process.env):ReferenceMaster{
  const mode=adminRuntimeMode(env);
  if(mode==='ERP5')return new Erp5ReferenceMaster(env);
  if(mode==='UNBOUND_PRODUCTION')throw new Error('ADMIN_PRODUCTION_REFERENCE_MASTER_NOT_BOUND');
  return new EnvReferenceMaster(env);
}
