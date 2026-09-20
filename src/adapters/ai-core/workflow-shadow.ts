import type { Application, ApplicationStatus } from '../../domain/application/types';

export const CORE_WORKFLOW_ID = 'freepass-admin.application-lifecycle';
export const CORE_WORKFLOW_VERSION = '0.1.0';
export const CORE_WORKFLOW_PROJECTION_ID = 'freepass-admin.application.status';
export const CORE_WORKFLOW_REVISION = 'd47c25a596b7185f2dcb81cc2e88566fd4d7bd45';

export interface ApplicationWorkflowShadow {
  workflowId: typeof CORE_WORKFLOW_ID;
  workflowVersion: typeof CORE_WORKFLOW_VERSION;
  coreRevision: typeof CORE_WORKFLOW_REVISION;
  states: {
    lifecycle: 'ACTIVE' | 'CANCELLED';
  };
  facts: {
    'application.contract-completed': boolean;
    'application.documents-completed': boolean;
    'application.balance-completed': boolean;
    'application.delivery-completed': boolean;
    'application.cancellation-reason': string | null;
  };
  projection: {
    projectionId: typeof CORE_WORKFLOW_PROJECTION_ID;
    value: ApplicationStatus;
  };
}

export function deriveApplicationStatusShadow(
  lifecycle: 'ACTIVE' | 'CANCELLED',
  facts: ApplicationWorkflowShadow['facts'],
): ApplicationStatus {
  if (lifecycle === 'CANCELLED') return 'CANCELLED';
  if (facts['application.delivery-completed']) return 'DELIVERED';
  if (facts['application.contract-completed']) return 'CONTRACTED';
  return 'RECEIVED';
}

export function applicationToWorkflowShadow(application: Application): ApplicationWorkflowShadow {
  const lifecycle = application.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE';
  const facts: ApplicationWorkflowShadow['facts'] = {
    'application.contract-completed': application.progress.contractCompleted,
    'application.documents-completed': application.progress.documentsCompleted,
    'application.balance-completed': application.progress.balanceCompleted,
    'application.delivery-completed': application.progress.deliveryCompleted,
    'application.cancellation-reason': application.cancellationReason ?? null,
  };

  return Object.freeze({
    workflowId: CORE_WORKFLOW_ID,
    workflowVersion: CORE_WORKFLOW_VERSION,
    coreRevision: CORE_WORKFLOW_REVISION,
    states: Object.freeze({ lifecycle }),
    facts: Object.freeze(facts),
    projection: Object.freeze({
      projectionId: CORE_WORKFLOW_PROJECTION_ID,
      value: deriveApplicationStatusShadow(lifecycle, facts),
    }),
  });
}

export function assertApplicationWorkflowShadowParity(application: Application): ApplicationWorkflowShadow {
  const shadow = applicationToWorkflowShadow(application);
  if (shadow.projection.value !== application.status) {
    throw new Error(
      `AI_CORE_WORKFLOW_SHADOW_DRIFT: source=${application.status} shadow=${shadow.projection.value}`,
    );
  }
  return shadow;
}
