import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalProduct } from '../../../domain/product/types';
import { AdminCatalogSwitchboard, FreePassDataCatalogHoldError, adminCatalogReadMode } from '../admin-catalog-reader';

const product = { id: 'P-1' } as CanonicalProduct;
const legacy = {
  async list() { return [product]; },
  async get(id: string) { return id === product.id ? product : null; },
  report() {
    return {
      project: 'freepasserp5', readAt: '2026-09-25T00:00:00.000Z',
      docs: 1, mapped: 1, skipped: { NOT_LISTABLE:0, NO_CAR_NUMBER:0, NO_PRICE:0, NO_VALID_OFFER:0 }, warnings: 0,
    };
  },
};

test('Admin Catalog defaults to FreePass Data OBSERVE boundary while serving the legacy bridge', async () => {
  assert.equal(adminCatalogReadMode(undefined), 'OBSERVE');
  const reader = new AdminCatalogSwitchboard(legacy, () => 'OBSERVE');
  const result = await reader.list();
  assert.deepEqual(result.rows, [product]);
  assert.equal(result.receipt.authority, 'FREEPASS_DATA');
  assert.equal(result.receipt.servedBy, 'LEGACY_ERP5_BRIDGE');
  assert.equal(result.receipt.cutoverAuthorized, false);
  assert.deepEqual(result.receipt.holdReasons, ['FREEPASS_DATA_ADMIN_CATALOG_CONTRACT_NOT_ACTIVE']);
});

test('LEGACY_DIRECT remains explicit and never becomes the authority label', async () => {
  const reader = new AdminCatalogSwitchboard(legacy, () => 'LEGACY_DIRECT');
  assert.equal((await reader.list()).receipt.authority, 'FREEPASS_DATA');
  assert.equal(reader.receipt().mode, 'LEGACY_DIRECT');
});

for (const mode of ['SHADOW_READ','PARITY_VERIFIED','FREEPASS_DATA_READ'] as const) {
  test(`${mode} fails closed until the FreePass Data Admin consumer contract exists`, async () => {
    const reader = new AdminCatalogSwitchboard(legacy, () => mode);
    await assert.rejects(() => reader.list(), (e: unknown) =>
      e instanceof FreePassDataCatalogHoldError && /fallback하지 않았다/.test(e.message));
    await assert.rejects(() => reader.get('P-1'), FreePassDataCatalogHoldError);
  });
}

test('unknown Admin Catalog read mode is rejected', () => {
  assert.throws(() => adminCatalogReadMode('DIRECT_FIRESTORE'), /모르는 프리패스 데이터/);
});
