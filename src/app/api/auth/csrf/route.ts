import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ADMIN_CSRF_COOKIE } from '../../../../server/auth/session';

export const dynamic='force-dynamic';

export async function GET(){
  const csrfToken=randomBytes(32).toString('base64url');
  const response=NextResponse.json({csrfToken});
  response.headers.set('Cache-Control','private, no-store');
  response.cookies.set(ADMIN_CSRF_COOKIE,csrfToken,{
    httpOnly:true,
    secure:process.env.NODE_ENV==='production',
    sameSite:'strict',
    path:'/',
    maxAge:10*60,
  });
  return response;
}
