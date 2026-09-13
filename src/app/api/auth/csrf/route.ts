import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { CSRF_COOKIE_NAME } from '@/server/auth/session-policy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const csrfToken = randomBytes(32).toString('base64url');
  const response = NextResponse.json({ csrfToken });
  response.headers.set('Cache-Control', 'private, no-store');
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
