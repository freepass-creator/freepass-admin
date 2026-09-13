import { timingSafeEqual } from 'node:crypto';
import { AccessError } from './errors';

export const CSRF_COOKIE_NAME = '__Host-freepass_csrf';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
export const RECENT_SIGN_IN_SECONDS = 5 * 60;

function sameToken(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateCsrfRequest(input: {
  requestUrl: string;
  origin: string | null;
  csrfCookie: string | undefined;
  csrfBody: string | undefined;
}): void {
  if (!input.origin || input.origin !== new URL(input.requestUrl).origin) {
    throw new AccessError('UNAUTHENTICATED', 401);
  }
  if (!sameToken(input.csrfCookie, input.csrfBody)) {
    throw new AccessError('UNAUTHENTICATED', 401);
  }
}

export function validateRecentSignIn(input: {
  authTimeSeconds: number | undefined;
  nowSeconds: number;
}): void {
  if (
    input.authTimeSeconds === undefined
    || input.nowSeconds - input.authTimeSeconds < 0
    || input.nowSeconds - input.authTimeSeconds > RECENT_SIGN_IN_SECONDS
  ) {
    throw new AccessError('UNAUTHENTICATED', 401);
  }
}


export function validateSessionExchange(input: {
  requestUrl: string;
  origin: string | null;
  csrfCookie: string | undefined;
  csrfBody: string | undefined;
  authTimeSeconds: number | undefined;
  nowSeconds: number;
}): void {
  validateCsrfRequest(input);
  validateRecentSignIn(input);
}
