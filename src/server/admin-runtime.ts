import { Erp5ApplicationRepository } from '../adapters/erp5/application-repository';
import { Erp5ProductRepository } from '../adapters/erp5/product-repository';
import { freePassDataProductRepositoryFromEnv } from '../adapters/freepass-data/product-repository';
import { FileApplicationRepository, FileProductRepository } from '../adapters/store/repositories';
import type { ActorProvider } from '../ports/auth';
import { sessionActorProvider } from './auth/session';
import type { ApplicationRepository, ProductRepository } from '../ports/repositories';
import { CachedProductRepository } from '../services/cached-product-repository';

export type AdminRuntimeMode = 'FILE_DEV' | 'ERP5' | 'UNBOUND_PRODUCTION';
export type AdminProductSourceMode = 'FILE' | 'ERP5' | 'FREEPASS_DATA' | 'UNBOUND_PRODUCTION';

export function adminRuntimeMode(env:NodeJS.ProcessEnv=process.env):AdminRuntimeMode{
  const requested=String(env.FPA_REPOSITORY_MODE||'').trim().toLowerCase();
  if(requested&&requested!=='file'&&requested!=='erp5')throw new Error('FPA_REPOSITORY_MODE_INVALID:'+requested);
  if(requested==='erp5')return'ERP5';
  if(env.NODE_ENV==='production')return'UNBOUND_PRODUCTION';
  return'FILE_DEV';
}

/**
 * Catalog read source is deliberately independent from operational persistence.
 *
 * During migration we can run:
 *   Product/Offer/Policy read -> FreePass Data
 *   Application/Performance/Settlement write -> Admin ERP5 namespace
 *
 * UI/Domain therefore do not need to change again at Data read cutover.
 */
export function adminProductSourceMode(
  env:NodeJS.ProcessEnv=process.env,
  runtimeMode:AdminRuntimeMode=adminRuntimeMode(env),
):AdminProductSourceMode{
  const requested=String(env.FPA_PRODUCT_SOURCE||'').trim().toLowerCase();
  if(requested&&!['file','erp5','freepass-data'].includes(requested)){
    throw new Error('FPA_PRODUCT_SOURCE_INVALID:'+requested);
  }
  if(requested==='freepass-data')return'FREEPASS_DATA';
  if(requested==='erp5')return'ERP5';
  if(requested==='file')return env.NODE_ENV==='production'?'UNBOUND_PRODUCTION':'FILE';

  if(runtimeMode==='ERP5')return'ERP5';
  if(runtimeMode==='FILE_DEV')return'FILE';
  return'UNBOUND_PRODUCTION';
}

const globalRuntime=globalThis as unknown as{
  __fpaErp5Products?:ProductRepository;
  __fpaDataProducts?:ProductRepository;
};

function erp5Products():ProductRepository{
  if(!globalRuntime.__fpaErp5Products){
    globalRuntime.__fpaErp5Products=new CachedProductRepository(new Erp5ProductRepository(),60_000);
  }
  return globalRuntime.__fpaErp5Products;
}

function dataProducts(env:NodeJS.ProcessEnv):ProductRepository{
  if(!globalRuntime.__fpaDataProducts){
    globalRuntime.__fpaDataProducts=new CachedProductRepository(
      freePassDataProductRepositoryFromEnv(env),
      60_000,
    );
  }
  return globalRuntime.__fpaDataProducts;
}

function productRepository(env:NodeJS.ProcessEnv,mode:AdminProductSourceMode):ProductRepository{
  if(mode==='ERP5')return erp5Products();
  if(mode==='FREEPASS_DATA')return dataProducts(env);
  if(mode==='FILE')return new FileProductRepository(env.FPA_DATA_DIR);
  throw new Error(
    'ADMIN_PRODUCTION_PRODUCT_SOURCE_NOT_BOUND: set FPA_PRODUCT_SOURCE=freepass-data after the approved Data consumer contract is active, or use erp5 during migration.',
  );
}

export function adminRepositories(env:NodeJS.ProcessEnv=process.env):{
  products:ProductRepository;
  applications:ApplicationRepository;
}{
  const mode=adminRuntimeMode(env);
  const productMode=adminProductSourceMode(env,mode);
  const products=productRepository(env,productMode);

  if(mode==='ERP5'){
    return{
      products,
      applications:new Erp5ApplicationRepository(),
    };
  }
  if(mode==='UNBOUND_PRODUCTION'){
    throw new Error(
      'ADMIN_PRODUCTION_PERSISTENCE_ADAPTER_NOT_BOUND: set FPA_REPOSITORY_MODE=erp5 only with approved ERP5 credentials and namespace.',
    );
  }
  return{
    products,
    applications:new FileApplicationRepository(env.FPA_DATA_DIR),
  };
}

export function adminActorProvider(env:NodeJS.ProcessEnv=process.env):ActorProvider{
  return sessionActorProvider(env);
}
