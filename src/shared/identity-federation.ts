/** Non-secret identity trust policy, shared by the runtime and deployment preflight. */
export const IDENTITY_WIF_AUDIENCE = '//iam.googleapis.com/projects/110304297079/locations/global/workloadIdentityPools/vercel/providers/freepass-admin-identity-prod';
export const IDENTITY_SERVICE_ACCOUNT = 'freepass-admin-identity@freepasserp5.iam.gserviceaccount.com';

export function identityFederationConfig(env: Record<string, string | undefined> = process.env) {
  const audience = env.IDENTITY_GCP_WIF_AUDIENCE?.trim();
  const email = env.IDENTITY_GCP_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!audience && !email) {
    if (env.VERCEL_ENV === 'production') throw new Error('IDENTITY_FEDERATION_REQUIRED');
    return null;
  }
  if (env.VERCEL_ENV !== 'production') throw new Error('IDENTITY_FEDERATION_PRODUCTION_ONLY');
  if (env.IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) throw new Error('IDENTITY_FEDERATION_KEY_FORBIDDEN');
  if (audience !== IDENTITY_WIF_AUDIENCE) throw new Error('IDENTITY_FEDERATION_PROVIDER_INVALID');
  if (email !== IDENTITY_SERVICE_ACCOUNT) throw new Error('IDENTITY_FEDERATION_ACCOUNT_INVALID');
  if (env.IDENTITY_FIREBASE_PROJECT_ID?.trim() !== 'freepasserp5') throw new Error('IDENTITY_FEDERATION_PROJECT_INVALID');
  return { audience, email, projectId: 'freepasserp5' };
}
