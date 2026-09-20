import { createHash } from 'node:crypto';

import type { ActorRef } from '../../domain/security/actor';
import type { Application } from '../../domain/application/types';
import { AppError } from '../../domain/errors';
import type { SubmitApplicationInput } from '../../services/applications';

export const CORE_ERROR_CONTRACT = 'core-error/v1';
export const CORE_REQUEST_CONTEXT_CONTRACT = 'core-request-context/v1';
export const CORE_SNAPSHOT_CONTRACT = 'core-snapshot/v1';

type CoreErrorCategory = 'USER' | 'SYSTEM' | 'PROVIDER';

export interface CoreErrorShadow {
  type: string;
  title: string;
  status: number;
  code: string;
  category: CoreErrorCategory;
  detail?: string;
  instance?: string;
  correlation_id: string;
  retryable: boolean;
  provider_id: string | null;
  meta: Record<string, unknown>;
}

const APP_ERROR_MAP = Object.freeze({
  VALIDATION: { code: 'VALIDATION_ERROR', status: 400, category: 'USER', retryable: false },
  NOT_FOUND: { code: 'NOT_FOUND', status: 404, category: 'USER', retryable: false },
  CONFLICT: { code: 'CONFLICT', status: 409, category: 'USER', retryable: false },
  VERSION_MISMATCH: { code: 'VERSION_MISMATCH', status: 409, category: 'USER', retryable: false },
  UNAUTHORIZED: { code: 'AUTHENTICATION_REQUIRED', status: 401, category: 'USER', retryable: false },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403, category: 'USER', retryable: false },
  CANCELLED: { code: 'CANCELLED', status: 409, category: 'USER', retryable: false },
  PERSISTENCE: { code: 'PERSISTENCE_ERROR', status: 500, category: 'SYSTEM', retryable: true },
  UNKNOWN: { code: 'INTERNAL_ERROR', status: 500, category: 'SYSTEM', retryable: false },
} as const satisfies Record<string, { code: string; status: number; category: CoreErrorCategory; retryable: boolean }>);

const SERVICE_REASON_MAP = Object.freeze({
  PRODUCT_NOT_FOUND: { code: 'NOT_FOUND', status: 404, category: 'USER', retryable: false },
  OFFER_NOT_FOUND: { code: 'NOT_FOUND', status: 404, category: 'USER', retryable: false },
  SALES_CHANNEL_NOT_ACTIVE: { code: 'VALIDATION_ERROR', status: 400, category: 'USER', retryable: false },
  ASSIGNEE_NOT_ACTIVE: { code: 'VALIDATION_ERROR', status: 400, category: 'USER', retryable: false },
  IDEMPOTENCY_KEY_REUSE: { code: 'CONFLICT', status: 409, category: 'USER', retryable: false },
  PRODUCT_CHANGED: { code: 'VERSION_MISMATCH', status: 409, category: 'USER', retryable: false },
  NOT_FOUND: { code: 'NOT_FOUND', status: 404, category: 'USER', retryable: false },
  CANCELLED: { code: 'CANCELLED', status: 409, category: 'USER', retryable: false },
  REASON_REQUIRED: { code: 'VALIDATION_ERROR', status: 400, category: 'USER', retryable: false },
} as const satisfies Record<string, { code: string; status: number; category: CoreErrorCategory; retryable: boolean }>);

function errorType(code: string): string {
  return `https://errors.freepass.ai/core/${code.toLowerCase().replaceAll('_', '-')}`;
}

function coreError(
  shape: { code: string; status: number; category: CoreErrorCategory; retryable: boolean },
  correlationId: string,
  detail?: string,
  meta: Record<string, unknown> = {},
  instance?: string,
): CoreErrorShadow {
  if (!correlationId.trim()) throw new Error('CORE_SHADOW_CORRELATION_ID_REQUIRED');
  return {
    type: errorType(shape.code),
    title: shape.code,
    status: shape.status,
    code: shape.code,
    category: shape.category,
    ...(detail ? { detail } : {}),
    ...(instance ? { instance } : {}),
    correlation_id: correlationId,
    retryable: shape.retryable,
    provider_id: null,
    meta,
  };
}

export function appErrorToCore(
  error: AppError,
  correlationId: string,
  instance?: string,
): CoreErrorShadow {
  const shape = APP_ERROR_MAP[error.code];
  return coreError(shape, correlationId, error.message, error.details ?? {}, instance);
}

export function serviceReasonToCore(
  reason: keyof typeof SERVICE_REASON_MAP,
  correlationId: string,
  meta: Record<string, unknown> = {},
  instance?: string,
): CoreErrorShadow {
  const shape = SERVICE_REASON_MAP[reason];
  if (!shape) throw new Error('CORE_SHADOW_SERVICE_REASON_UNMAPPED');
  return coreError(shape, correlationId, reason, meta, instance);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
}

export function submitRequestToCoreContext(input: SubmitApplicationInput, actor: ActorRef) {
  const semanticPayload = {
    productId: input.productId,
    offerId: input.offerId,
    salesChannelId: input.salesChannelId,
    assigneeId: input.assigneeId,
    applicantName: input.applicantName,
    applicantPhone: input.applicantPhone ?? null,
    expectedProductVersion: input.expectedProductVersion,
    source: input.source ?? 'ADMIN',
  };

  return Object.freeze({
    schema_version: CORE_REQUEST_CONTEXT_CONTRACT,
    request_id: input.submissionId,
    correlation_id: `application:${input.submissionId}`,
    actor: {
      actor_id: actor.id,
      actor_type: actor.type === 'SYSTEM' ? 'SYSTEM' : 'USER',
    },
    expected_revision: `product:${input.productId}:v${input.expectedProductVersion}`,
    idempotency: {
      mode: 'REQUIRED',
      key: input.submissionId,
      semantic_payload_digest: digest(semanticPayload),
    },
  });
}

export function applicationSnapshotToCore(application: Application) {
  const snapshot = application.snapshot;
  const revision = `product:${snapshot.productId}:v${snapshot.productVersion}`;
  return Object.freeze({
    schema_version: CORE_SNAPSHOT_CONTRACT,
    snapshot_id: `${application.id}:product-snapshot`,
    subject_type: 'application.product-snapshot',
    subject_id: application.id,
    subject_revision: revision,
    source_revision: revision,
    created_at: snapshot.capturedAt,
    payload: snapshot,
    payload_digest: digest(snapshot),
  });
}
