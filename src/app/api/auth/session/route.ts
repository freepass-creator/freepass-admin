import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isStaffRole } from '@/domain/access/access-control';
import { AccessError } from '@/server/auth/errors';
import { firestoreStaffAccounts } from '@/server/auth/firebase-adapters';
import { SESSION_COOKIE_NAME } from '@/server/auth/server-session';
import {
  CSRF_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  validateCsrfRequest,
  validateRecentSignIn,
} from '@/server/auth/session-policy';
import { getFreePassFirebaseAuth } from '@/server/firebase/admin';

const bodySchema = z.object({
  idToken: z.string().min(1),
  csrfToken: z.string().min(1),
}).strict();

function errorResponse(error: unknown) {
  const status = error instanceof AccessError ? error.status : 401;
  const response = NextResponse.json(
    { error: status === 503 ? 'AUTH_NOT_CONFIGURED' : 'UNAUTHORIZED' },
    { status },
  );
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.parse(await request.json());
    const cookieStore = await cookies();
    validateCsrfRequest({
      requestUrl: request.url,
      origin: request.headers.get('origin'),
      csrfCookie: cookieStore.get(CSRF_COOKIE_NAME)?.value,
      csrfBody: parsed.csrfToken,
    });

    const auth = getFreePassFirebaseAuth();
    const claims = await auth.verifyIdToken(parsed.idToken, true);
    validateRecentSignIn({
      authTimeSeconds: claims.auth_time,
      nowSeconds: Math.floor(Date.now() / 1000),
    });

    const account = await firestoreStaffAccounts.findByUid(claims.uid);
    if (!account || account.status !== 'ACTIVE' || !isStaffRole(account.role)) {
      throw new AccessError(account?.status === 'DISABLED' ? 'ACCOUNT_DISABLED' : 'ROLE_NOT_ALLOWED', 403);
    }

    const sessionCookie = await auth.createSessionCookie(parsed.idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });
    const response = NextResponse.json({ ok: true });
    response.headers.set('Cache-Control', 'private, no-store');
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    response.cookies.set(CSRF_COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
