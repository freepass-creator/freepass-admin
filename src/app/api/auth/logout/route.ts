import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '../../../../server/auth/session';

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(!origin||origin!==new URL(request.url).origin){
    return NextResponse.json({ok:false,error:'UNAUTHORIZED'},{status:401});
  }
  const response=NextResponse.json({ok:true});
  response.headers.set('Cache-Control','private, no-store');
  response.cookies.set(ADMIN_SESSION_COOKIE,'',{
    httpOnly:true,
    secure:process.env.NODE_ENV==='production',
    sameSite:'strict',
    path:'/',
    maxAge:0,
  });
  return response;
}
