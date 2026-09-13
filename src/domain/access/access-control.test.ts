import assert from 'node:assert/strict';
import test from 'node:test';
import { PRODUCTS } from '@/demo/catalog';
import { createAdminApplication } from '@/domain/application/create-admin-application';
import { assertCan, can, isStaffRole, type Capability } from './access-control';
import { projectProductForSales } from './sales-product';

const administrativeCapabilities: Capability[] = [
  'APPLICATION_READ',
  'APPLICATION_MANAGE',
  'PERFORMANCE_READ',
  'PERFORMANCE_MANAGE',
  'SETTLEMENT_READ',
  'SETTLEMENT_MANAGE',
];

test('ADMIN can operate the full workflow while SALES is product-read-only', () => {
  for (const capability of ['PRODUCT_SEARCH', 'PRODUCT_DETAIL', ...administrativeCapabilities] as Capability[]) {
    assert.equal(can('ADMIN', capability), true);
  }
  assert.equal(can('SALES', 'PRODUCT_SEARCH'), true);
  assert.equal(can('SALES', 'PRODUCT_DETAIL'), true);
  for (const capability of administrativeCapabilities) {
    assert.equal(can('SALES', capability), false);
    assert.throws(() => assertCan('SALES', capability), new RegExp(`FORBIDDEN:${capability}`));
  }
});

test('unknown and WHITE LABEL surface values are not promoted to staff roles', () => {
  assert.equal(isStaffRole('ADMIN'), true);
  assert.equal(isStaffRole('SALES'), true);
  assert.equal(isStaffRole('WHITE_LABEL'), false);
  assert.equal(isStaffRole('UNKNOWN'), false);
  assert.equal(isStaffRole(undefined), false);
});

test('SALES cannot create an application by injecting an ADMIN source', () => {
  const product = PRODUCTS[0].product;
  assert.throws(() => createAdminApplication('SALES', {
    id: 'blocked-application',
    applicationNumber: 'A-BLOCKED',
    submissionId: 'blocked-submission',
    customerName: '차단 고객',
    salesChannelId: 'online',
    assigneeId: 'admin-1',
    product,
    productVersion: product.version,
    offerId: product.offers[0].id,
    now: '2026-09-13T00:00:00.000Z',
  }), /FORBIDDEN:APPLICATION_MANAGE/);
});

test('SALES product projection excludes supplier and source metadata', () => {
  const projection = projectProductForSales(PRODUCTS[0]);
  const serialized = JSON.stringify(projection);
  assert.equal('supplierId' in projection, false);
  assert.equal('supplierProductKey' in projection, false);
  assert.equal(serialized.includes('sourceSnapshotId'), false);
  assert.equal(serialized.includes('supplier-a'), false);
  assert.equal(serialized.includes('A-CV-001'), false);
  assert.equal(projection.displayName, PRODUCTS[0].product.displayName);
  assert.equal(projection.offers.length, PRODUCTS[0].product.offers.length);
});
