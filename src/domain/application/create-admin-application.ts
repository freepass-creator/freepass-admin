import { assertCan, type StaffRole } from '@/domain/access/access-control';
import { createApplication, type CreateApplicationInput } from './create-application';

export type CreateAdminApplicationInput = Omit<CreateApplicationInput, 'source'>;

export function createAdminApplication(role: StaffRole, input: CreateAdminApplicationInput) {
  assertCan(role, 'APPLICATION_MANAGE');
  return createApplication({ ...input, source: 'ADMIN' });
}
