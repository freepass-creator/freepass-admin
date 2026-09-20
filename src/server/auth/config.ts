import { readFileSync } from 'node:fs';

export type AdminAuthMode='DEV'|'FIREBASE'|'UNBOUND_PRODUCTION';

type ServiceAccount={project_id:string;client_email:string;private_key:string};

export function adminAuthMode(env:NodeJS.ProcessEnv=process.env):AdminAuthMode{
  const requested=String(env.FPA_AUTH_MODE||'').trim().toLowerCase();
  if(requested&&requested!=='dev'&&requested!=='firebase')throw new Error('FPA_AUTH_MODE_INVALID:'+requested);
  if(requested==='firebase')return'FIREBASE';
  if(env.NODE_ENV==='production')return'UNBOUND_PRODUCTION';
  return'DEV';
}

export function parseAdminAuthServiceAccount(env:NodeJS.ProcessEnv=process.env):ServiceAccount{
  const expected=String(env.FPA_AUTH_PROJECT_ID||'').trim();
  if(!expected)throw new Error('FPA_AUTH_PROJECT_ID_REQUIRED');

  const raw=String(env.FPA_AUTH_SERVICE_ACCOUNT_JSON||'').trim();
  const path=String(env.FPA_AUTH_SERVICE_ACCOUNT_PATH||'').trim();
  let parsed:Partial<ServiceAccount>;

  if(raw){
    try{parsed=JSON.parse(raw) as Partial<ServiceAccount>;}
    catch{throw new Error('FPA_AUTH_SERVICE_ACCOUNT_JSON_INVALID');}
  }else if(path){
    try{parsed=JSON.parse(readFileSync(path,'utf8')) as Partial<ServiceAccount>;}
    catch{throw new Error('FPA_AUTH_SERVICE_ACCOUNT_PATH_INVALID');}
  }else{
    throw new Error('FPA_AUTH_SERVICE_ACCOUNT_REQUIRED');
  }

  const project_id=String(parsed.project_id||'').trim();
  const client_email=String(parsed.client_email||'').trim();
  const private_key=String(parsed.private_key||'');
  if(!project_id||!client_email||!private_key)throw new Error('FPA_AUTH_SERVICE_ACCOUNT_FIELDS_REQUIRED');
  if(project_id!==expected)throw new Error('FPA_AUTH_PROJECT_ID_MISMATCH:'+project_id);
  return{project_id,client_email,private_key};
}

export function adminUidAllowlist(env:NodeJS.ProcessEnv=process.env):Set<string>{
  return new Set(
    String(env.FPA_ADMIN_UIDS||'')
      .split(',')
      .map((x)=>x.trim())
      .filter(Boolean),
  );
}

export function requireAdminUid(uid:string,env:NodeJS.ProcessEnv=process.env){
  const allowed=adminUidAllowlist(env);
  if(!allowed.size)throw new Error('FPA_ADMIN_UIDS_REQUIRED');
  if(!allowed.has(uid))throw new Error('ADMIN_UID_NOT_ALLOWED');
}

export function authWebApiKey(env:NodeJS.ProcessEnv=process.env){
  const key=String(env.FPA_AUTH_WEB_API_KEY||'').trim();
  if(!key)throw new Error('FPA_AUTH_WEB_API_KEY_REQUIRED');
  return key;
}
