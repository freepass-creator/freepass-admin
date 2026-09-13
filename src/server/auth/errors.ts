export type AccessErrorCode =
  | 'UNAUTHENTICATED'
  | 'ACCOUNT_DISABLED'
  | 'ROLE_NOT_ALLOWED'
  | 'AUTH_NOT_CONFIGURED';

export class AccessError extends Error {
  constructor(
    readonly code: AccessErrorCode,
    readonly status: 401 | 403 | 503,
  ) {
    super(code);
    this.name = 'AccessError';
  }
}
