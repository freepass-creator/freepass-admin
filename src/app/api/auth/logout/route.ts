import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/server/auth/server-session';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.headers.set('Cache-Control', 'private, no-store');
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
