import { timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import type { ActorProvider } from '../../ports/auth';
import { adminAuthMode, requireAdminUid } from './config';
import { adminFirebaseAuth } from './firebase';

export const ADMIN_SESSION_COOKIE='freepass_admin_session';
export const ADMIN_CSRF_COOKIE='freepass_admin_csrf';
export const ADMIN_SESSION_MAX_AGE_SECONDS=12*60*60;
export const ADMIN_RECENT_SIGN_IN_SECONDS=5*60;

function sameToken(a:string|undefined,b:string|undefined){
  if(!a||!b)return false;
  const aa=Buffer.from(a),bb=Buffer.from(b);
  return aa.length===bb.length&&timingSafeEqual(aa,bb);
}

export function validateCsrf(input:{
  requestUrl:string;origin:string|null;cookie:string|undefined;body:string|undefined;
}){
  if(!input.origin||input.origin!==new URL(input.requestUrl).origin)throw new Error('AUTH_ORIGIN_INVALID');
  if(!sameToken(input.cookie,input.body))throw new Error('AUTH_CSRF_INVALID');
}

export function validateRecentSignIn(authTime:number|undefined,nowSeconds:number){
  if(
    authTime===undefined
    ||nowSeconds-authTime<0
    ||nowSeconds-authTime>ADMIN_RECENT_SIGN_IN_SECONDS
  )throw new Error('AUTH_RECENT_SIGN_IN_REQUIRED');
}

export async function requireAdminSessionActor(
  env:NodeJS.ProcessEnv=process.env,
):Promise<{id:string;type:'ADMIN'}>{
  const mode=adminAuthMode(env);
  if(mode==='UNBOUND_PRODUCTION')throw new Error('ADMIN_PRODUCTION_AUTH_NOT_BOUND');
  if(mode==='DEV'){
    const id=String(env.FPA_DEV_ACTOR_ID||'dev-admin').trim();
    if(!id)throw new Error('FPA_DEV_ACTOR_ID_REQUIRED');
    return{id,type:'ADMIN'};
  }

  const jar=await cookies();
  const session=jar.get(ADMIN_SESSION_COOKIE)?.value;
  if(!session)throw new Error('ADMIN_SESSION_REQUIRED');

  let decoded;
  try{decoded=await adminFirebaseAuth(env).verifySessionCookie(session,true);}
  catch{throw new Error('ADMIN_SESSION_INVALID');}
  requireAdminUid(decoded.uid,env);
  return{id:decoded.uid,type:'ADMIN'};
}

export function sessionActorProvider(env:NodeJS.ProcessEnv=process.env):ActorProvider{
  return{requireActor:()=>requireAdminSessionActor(env)};
}

export async function requestOriginMatches(){
  const h=await headers();
  const origin=h.get('origin');
  const host=h.get('host');
  if(!origin||!host)return false;
  try{return new URL(origin).host===host;}catch{return false;}
}
