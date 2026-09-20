import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuthMode, authWebApiKey, requireAdminUid } from '../../../../server/auth/config';
import { adminFirebaseAuth } from '../../../../server/auth/firebase';
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  validateCsrf,
  validateRecentSignIn,
} from '../../../../server/auth/session';

const bodySchema=z.object({
  email:z.string().email(),
  password:z.string().min(1),
  csrfToken:z.string().min(1),
}).strict();

function failure(status:number,code:string){
  const response=NextResponse.json({ok:false,error:code},{status});
  response.headers.set('Cache-Control','private, no-store');
  return response;
}

export async function POST(request:Request){
  try{
    if(adminAuthMode()!=='FIREBASE')return failure(503,'AUTH_NOT_CONFIGURED');

    const parsed=bodySchema.parse(await request.json());
    const jar=await cookies();
    validateCsrf({
      requestUrl:request.url,
      origin:request.headers.get('origin'),
      cookie:jar.get(ADMIN_CSRF_COOKIE)?.value,
      body:parsed.csrfToken,
    });

    const key=authWebApiKey();
    const login=await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(key),
      {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:parsed.email,password:parsed.password,returnSecureToken:true}),
        signal:AbortSignal.timeout(10_000),
        cache:'no-store',
      },
    );
    const payload=await login.json() as {idToken?:string;error?:{message?:string}};
    if(!login.ok||!payload.idToken)return failure(401,'UNAUTHORIZED');

    const auth=adminFirebaseAuth();
    const decoded=await auth.verifyIdToken(payload.idToken,true);
    validateRecentSignIn(decoded.auth_time,Math.floor(Date.now()/1000));
    requireAdminUid(decoded.uid);

    const session=await auth.createSessionCookie(payload.idToken,{
      expiresIn:ADMIN_SESSION_MAX_AGE_SECONDS*1000,
    });

    const response=NextResponse.json({ok:true});
    response.headers.set('Cache-Control','private, no-store');
    response.cookies.set(ADMIN_SESSION_COOKIE,session,{
      httpOnly:true,
      secure:process.env.NODE_ENV==='production',
      sameSite:'strict',
      path:'/',
      maxAge:ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    response.cookies.set(ADMIN_CSRF_COOKIE,'',{
      httpOnly:true,
      secure:process.env.NODE_ENV==='production',
      sameSite:'strict',
      path:'/',
      maxAge:0,
    });
    return response;
  }catch{
    return failure(401,'UNAUTHORIZED');
  }
}
