import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createApplication } from '../create-application';
import { offer, policy, product } from '../../search/__tests__/fixtures';

describe('Application Snapshot deep clone', () => {
  it('MULTI_SELECT 배열을 원 상품과 공유하지 않는다', () => {
    const source = product({
      id: 'product-deep-copy',
      offers: [
        offer({
          id: 'offer-deep-copy',
          policyValues: [policy('offer-docs', 'MULTI_SELECT', ['면허증'])],
        }),
      ],
      productPolicies: [policy('product-docs', 'MULTI_SELECT', ['등본'])],
    });

    const application = createApplication({
      id: 'app-deep-copy',
      applicationNumber: 'A-260919-001',
      applicantName: '테스트',
      salesChannelId: 'channel-1',
      assigneeId: 'staff-1',
      source: 'ADMIN',
      product: source,
      offerId: 'offer-deep-copy',
      submissionId: 'submission-deep-copy',
      actor: { id: 'staff-1', type: 'ADMIN' },
      now: '2026-09-19T10:30:00.000Z',
    });

    const sourceOfferPolicy = source.offers[0].policyValues[0];
    const sourceProductPolicy = source.productPolicies[0];
    if (sourceOfferPolicy.type !== 'MULTI_SELECT' || sourceProductPolicy.type !== 'MULTI_SELECT') {
      throw new Error('fixture must be MULTI_SELECT');
    }

    sourceOfferPolicy.value.push('추가서류');
    sourceProductPolicy.value.push('추가정책');

    const snapshotOfferPolicy = application.snapshot.offer.policyValues[0];
    const snapshotProductPolicy = application.snapshot.productPolicies[0];
    if (snapshotOfferPolicy.type !== 'MULTI_SELECT' || snapshotProductPolicy.type !== 'MULTI_SELECT') {
      throw new Error('snapshot must be MULTI_SELECT');
    }

    assert.deepEqual(snapshotOfferPolicy.value, ['면허증']);
    assert.deepEqual(snapshotProductPolicy.value, ['등본']);
  });
});
