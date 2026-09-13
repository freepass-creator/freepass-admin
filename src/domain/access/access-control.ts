export type Surface = 'ADMIN' | 'SALES' | 'WHITE_LABEL';
export type StaffRole = 'ADMIN' | 'SALES';

export type Capability =
  | 'PRODUCT_SEARCH'
  | 'PRODUCT_DETAIL'
  | 'APPLICATION_READ'
  | 'APPLICATION_MANAGE'
  | 'PERFORMANCE_READ'
  | 'PERFORMANCE_MANAGE'
  | 'SETTLEMENT_READ'
  | 'SETTLEMENT_MANAGE';

const CAPABILITIES: Record<StaffRole, ReadonlySet<Capability>> = {
  ADMIN: new Set<Capability>([
    'PRODUCT_SEARCH',
    'PRODUCT_DETAIL',
    'APPLICATION_READ',
    'APPLICATION_MANAGE',
    'PERFORMANCE_READ',
    'PERFORMANCE_MANAGE',
    'SETTLEMENT_READ',
    'SETTLEMENT_MANAGE',
  ]),
  SALES: new Set<Capability>(['PRODUCT_SEARCH', 'PRODUCT_DETAIL']),
};

export function isStaffRole(value: unknown): value is StaffRole {
  return value === 'ADMIN' || value === 'SALES';
}

export function can(role: StaffRole, capability: Capability): boolean {
  return CAPABILITIES[role].has(capability);
}

export function assertCan(role: StaffRole, capability: Capability): void {
  if (!can(role, capability)) throw new Error(`FORBIDDEN:${capability}`);
}
