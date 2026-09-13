import { createHash } from 'node:crypto';
import { assertCan, type StaffRole } from '@/domain/access/access-control';
import { createAdminApplication, type CreateAdminApplicationInput } from './create-admin-application';
import type { Application } from './types';

export type ApplicationCreateOutcome =
  | { outcome: 'CREATED'; application: Application }
  | { outcome: 'REPLAYED'; application: Application };

export interface ApplicationCreateStore {
  createOrReplay(
    submissionId: string,
    requestFingerprint: string,
    create: () => Application,
  ): Promise<ApplicationCreateOutcome>;
}

export function fingerprintApplicationInput(input: CreateAdminApplicationInput): string {
  const normalized = JSON.stringify({
    submissionId: input.submissionId.trim(),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() || null,
    salesChannelId: input.salesChannelId.trim(),
    assigneeId: input.assigneeId.trim(),
    source: 'ADMIN',
    productId: input.product.id,
    productVersion: input.productVersion,
    offerId: input.offerId,
  });
  return createHash('sha256').update(normalized).digest('hex');
}

export async function createAdminApplicationIdempotently(
  role: StaffRole,
  input: CreateAdminApplicationInput,
  store: ApplicationCreateStore,
): Promise<ApplicationCreateOutcome> {
  assertCan(role, 'APPLICATION_MANAGE');
  return store.createOrReplay(
    input.submissionId,
    fingerprintApplicationInput(input),
    () => createAdminApplication(role, input),
  );
}
