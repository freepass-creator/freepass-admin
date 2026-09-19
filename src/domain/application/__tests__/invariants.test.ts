import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createApplication } from '../create-application';
import { assertApplicationMutation } from '../invariants';
import { isAppError } from '../../errors';
import { offer, product } from '../../search/__tests__/fixtures';

function baseApplication() {
  return createApplication({
    id: 'app-invariant',
    applicationNumber: 'A-260919-001',
    applicantName: '테스트',
    salesChannelId: 'channel-1',
    assigneeId: 'staff-1',
    source: 'ADMIN',
    product: product({
      id: 'product-invariant',
      offers: [offer({ id: 'offer-invariant', monthlyRent: 700_000 })],
    }),
    offerId: 'offer-invariant',
    submissionId: 'submission-invariant',
    actor: { id: 'staff-1', type: 'ADMIN' },
    now: '2026-09-19T10:35:00.000Z',
  });
}

describe('Application mutation invariants', () => {
  it('접수 Snapshot을 나중에 바꾸지 못한다', () => {
    const before = baseApplication();
    const after = {
      ...before,
      snapshot: {
        ...before.snapshot,
        offer: {
          ...before.snapshot.offer,
          monthlyRent: 999_000,
        },
      },
    };

    assert.throws(
      () => assertApplicationMutation(before, after),
      (error: unknown) => isAppError(error, 'CONFLICT'),
    );
  });

  it('기존 감사 이력을 삭제하거나 다시 쓰지 못한다', () => {
    const before = baseApplication();
    const after = { ...before, history: [] };

    assert.throws(
      () => assertApplicationMutation(before, after),
      (error: unknown) => isAppError(error, 'CONFLICT'),
    );
  });

  it('기존 이력을 보존한 append는 허용한다', () => {
    const before = baseApplication();
    const after = {
      ...before,
      history: [
        ...before.history,
        {
          type: 'APPLICATION_PROGRESS_CHANGED' as const,
          occurredAt: '2026-09-19T10:36:00.000Z',
          actor: { id: 'staff-1', type: 'ADMIN' as const },
          key: 'documentsCompleted' as const,
          from: false,
          to: true,
        },
      ],
    };

    assert.doesNotThrow(() => assertApplicationMutation(before, after));
  });
});
