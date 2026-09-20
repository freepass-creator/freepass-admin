import { Erp5ApplicationRepository } from '../adapters/erp5/application-repository';
import { Erp5ProductRepository } from '../adapters/erp5/product-repository';
import { FileApplicationRepository, FileProductRepository } from '../adapters/store/repositories';
import type { ActorProvider } from '../ports/auth';
import type { ApplicationRepository, ProductRepository } from '../ports/repositories';

export type AdminRuntimeMode = 'FILE_DEV' | 'ERP5' | 'UNBOUND_PRODUCTION';

export function adminRuntimeMode(env:NodeJS.ProcessEnv=process.env):AdminRuntimeMode{
  const requested=String(env.FPA_REPOSITORY_MODE||'').trim().toLowerCase();
  if(requested&&requested!=='file'&&requested!=='erp5')throw new Error('FPA_REPOSITORY_MODE_INVALID:'+requested);
  if(requested==='erp5')return'ERP5';
  if(env.NODE_ENV==='production')return'UNBOUND_PRODUCTION';
  return'FILE_DEV';
}

export function adminRepositories(env:NodeJS.ProcessEnv=process.env):{
  products:ProductRepository;
  applications:ApplicationRepository;
}{
  const mode=adminRuntimeMode(env);
  if(mode==='ERP5'){
    return{
      products:new Erp5ProductRepository(),
      applications:new Erp5ApplicationRepository(),
    };
  }
  if(mode==='UNBOUND_PRODUCTION'){
    throw new Error(
      'ADMIN_PRODUCTION_PERSISTENCE_ADAPTER_NOT_BOUND: set FPA_REPOSITORY_MODE=erp5 only with approved ERP5 credentials and namespace.',
    );
  }
  return{
    products:new FileProductRepository(env.FPA_DATA_DIR),
    applications:new FileApplicationRepository(env.FPA_DATA_DIR),
  };
}

export function adminActorProvider(env:NodeJS.ProcessEnv=process.env):ActorProvider{
  if(env.NODE_ENV==='production'){
    throw new Error(
      'ADMIN_PRODUCTION_ACTOR_ADAPTER_NOT_BOUND: approved production authentication adapter is not connected yet.',
    );
  }
  const id=String(env.FPA_DEV_ACTOR_ID||'dev-admin').trim();
  if(!id)throw new Error('FPA_DEV_ACTOR_ID must not be empty.');
  return{requireActor:async()=>({id,type:'ADMIN' as const})};
}
