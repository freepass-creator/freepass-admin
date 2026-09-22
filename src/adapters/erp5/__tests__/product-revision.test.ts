import assert from 'node:assert/strict';
import test from 'node:test';

import { productSourceRevision } from '../product-repository';
import { toCanonicalProduct } from '../to-canonical';

test('ERP5 product source revision is stable for the same source revisions', () => {
  assert.equal(productSourceRevision(100, 20), productSourceRevision(100, 20));
  assert.notEqual(productSourceRevision(101, 20), productSourceRevision(100, 20));
  assert.notEqual(productSourceRevision(100, 21), productSourceRevision(100, 20));
});

test('canonical product keeps the authoritative Firestore revision as version', () => {
  const source = {
    car_number: '12가3456',
    product_code: 'P-1',
    provider_company_code: 'SUP-1',
    maker: '현대',
    model: '그랜저',
    price: {
      '36': { rent: 690000, deposit: 0 },
    },
  };

  const result = toCanonicalProduct(
    source,
    '12가3456',
    undefined,
    productSourceRevision(123456, 0),
    undefined,
    123456,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.product.version, 123456);
  assert.equal(result.product.sourceSnapshotId, productSourceRevision(123456, 0));
});
