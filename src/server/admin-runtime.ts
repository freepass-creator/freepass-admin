import { Erp5ApplicationRepository } from '../adapters/erp5/application-repository';
import { Erp5ProductRepository } from '../adapters/erp5/product-repository';
import { FileApplicationRepository, FileProductRepository } from '../adapters/store/repositories';
import type { ActorProvider } from '../ports/auth';
import { sessionActorProvider } from './auth/session';
import type { ApplicationRepository, ProductRepository } from '../ports/repositories';
import { CachedProductRepository } from '../services/cached-product-repository';

export type AdminRuntimeMode = 'FILE_DEV' | 'ERP5' | 'UNBOUND_PRODUCTION';

export function adminRuntimeMode(env:NodeJS.ProcessEnv=process.env):AdminRuntimeMode{
  const requested=String(env.FPA_REPOSITORY_MODE||'').trim().toLowerCase();
  if(requested&&requested!=='file'&&requested!=='erp5')throw new Error('FPA_REPOSITORY_MODE_INVALID:'+requested);
  if(requested==='erp5')return'ERP5';
  if(env.NODE_ENV==='production')return'UNBOUND_PRODUCTION';
  return'FILE_DEV';
}

const globalRuntime=globalThis as unknown as{__fpaErp5Products?:ProductRepository};

function erp5Products():ProductRepository{
  if(!globalRuntime.__fpaErp5Products){
    globalRuntime.__fpaErp5Products=new CachedProductRepository(new Erp5ProductRepository(),60_000);
  }
  return globalRuntime.__fpaErp5Products;
}

export function adminRepositories(env:NodeJS.ProcessEnv=process.env):{
  products:ProductRepository;
  applications:ApplicationRepository;
}{
  const mode=adminRuntimeMode(env);
  if(mode==='ERP5'){
    return{
      products:erp5Products(),
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
  return sessionActorProvider(env);
}
