import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export const ERP5_PROJECT_ID='freepasserp5';
const APP_NAME='freepass-admin-erp5';

type ServiceAccount={project_id:string;client_email:string;private_key:string};

export function parseErp5ServiceAccount(env:NodeJS.ProcessEnv=process.env):ServiceAccount{
  const raw=String(env.ERP5_FIREBASE_SERVICE_ACCOUNT_JSON||'').trim();
  const path=String(env.ERP5_SERVICE_ACCOUNT_PATH||'').trim();
  let parsed:Partial<ServiceAccount>;

  if(raw){
    try{parsed=JSON.parse(raw) as Partial<ServiceAccount>;}
    catch{throw new Error('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON_INVALID');}
  }else if(path){
    try{parsed=JSON.parse(readFileSync(path,'utf8')) as Partial<ServiceAccount>;}
    catch{throw new Error('ERP5_SERVICE_ACCOUNT_PATH_INVALID');}
  }else{
    throw new Error('ERP5_CREDENTIAL_REQUIRED');
  }

  const project_id=String(parsed.project_id||'').trim();
  const client_email=String(parsed.client_email||'').trim();
  const private_key=String(parsed.private_key||'');
  if(!project_id||!client_email||!private_key)throw new Error('ERP5_CREDENTIAL_FIELDS_REQUIRED');
  if(project_id!==ERP5_PROJECT_ID)throw new Error('ERP5_PROJECT_ID_MISMATCH:'+project_id);
  return{project_id,client_email,private_key};
}

let app:App|null=null;

export function erp5App(env:NodeJS.ProcessEnv=process.env):App{
  if(app)return app;
  const existing=getApps().find((x)=>x.name===APP_NAME);
  if(existing)return(app=existing);
  const sa=parseErp5ServiceAccount(env);
  app=initializeApp({
    credential:cert({projectId:sa.project_id,clientEmail:sa.client_email,privateKey:sa.private_key}),
    projectId:sa.project_id,
  },APP_NAME);
  return app;
}

export function erp5(env:NodeJS.ProcessEnv=process.env):Firestore{
  return getFirestore(erp5App(env));
}

export function erp5WriteEnabled(env:NodeJS.ProcessEnv=process.env){
  return String(env.ERP5_WRITE||'').trim()==='on';
}

export function requireErp5Write(env:NodeJS.ProcessEnv=process.env){
  if(!erp5WriteEnabled(env))throw new Error('ERP5_WRITE_DISABLED');
}

export function erp5AdminNamespace(env:NodeJS.ProcessEnv=process.env){
  const value=String(env.ERP5_ADMIN_NAMESPACE||'').trim();
  if(!/^[A-Za-z0-9_-]{3,64}$/.test(value))throw new Error('ERP5_ADMIN_NAMESPACE_REQUIRED');
  return value;
}

export function erp5AdminCollection(kind:'applications'|'counters'|'performances'|'settlements'|'billings'|'ledger',env:NodeJS.ProcessEnv=process.env){
  return erp5AdminNamespace(env)+'_'+kind;
}
