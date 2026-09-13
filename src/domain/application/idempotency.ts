import { createHash } from 'node:crypto';
import { createApplication, type CreateApplicationInput } from './create-application';
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

export function fingerprintApplicationInput(input: CreateApplicationInput): string {
  const normalized = JSON.stringify({
    submissionId: input.submissionId.trim(),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() || null,
    salesChannelId: input.salesChannelId.trim(),
    assigneeId: input.assigneeId.trim(),
    source: input.source,
    productId: input.product.id,
    productVersion: input.productVersion,
    offerId: input.offerId,
  });
  return createHash('sha256').update(normalized).digest('hex');
}

export async function createApplicationIdempotently(
  input: CreateApplicationInput,
  store: ApplicationCreateStore,
): Promise<ApplicationCreateOutcome> {
  return store.createOrReplay(
    input.submissionId,
    fingerprintApplicationInput(input),
    () => createApplication(input),
  );
}
