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
  const reader = new AdminCatalogSwitchboard(legacy, undefined, () => 'OBSERVE');
  const result = await reader.list();
  assert.deepEqual(result.rows, [product]);
  assert.equal(result.receipt.authority, 'FREEPASS_DATA');
  assert.equal(result.receipt.servedBy, 'LEGACY_ERP5_BRIDGE');
  assert.equal(result.receipt.cutoverAuthorized, false);
  assert.deepEqual(result.receipt.holdReasons, ['FREEPASS_DATA_ADMIN_CATALOG_CONTRACT_NOT_ACTIVE']);
});

test('LEGACY_DIRECT remains explicit and never becomes the authority label', async () => {
  const reader = new AdminCatalogSwitchboard(legacy, undefined, () => 'LEGACY_DIRECT');
  assert.equal((await reader.list()).receipt.authority, 'FREEPASS_DATA');
  assert.equal(reader.receipt().mode, 'LEGACY_DIRECT');
});

test('SHADOW_READ returns legacy rows but records HOLD when Data reader is not configured', async () => {
  const reader = new AdminCatalogSwitchboard(legacy, undefined, () => 'SHADOW_READ');
  const result = await reader.list();
  assert.deepEqual(result.rows, [product]);
  assert.equal(result.receipt.servedBy, 'LEGACY_ERP5_BRIDGE');
  assert.equal(result.receipt.shadow?.status, 'HOLD');
  assert.deepEqual(result.receipt.holdReasons, ['FREEPASS_DATA_SHADOW_READER_NOT_CONFIGURED']);
});

const shadowProduct = {
  id: 'P-1', version: 1, supplierId: 'SUP-1', supplierProductKey: 'P-1',
  vehicle: { nodeId: 'VM-1', originId: '', manufacturerId: '현대', modelId: '그랜저', matchLevel: 'MODEL' },
  specs: {}, registration: { vehicleNumber: '12가3456' },
  offers: [{
    id: 'O-1#36', supplierId: 'SUP-1', termMonths: 36, monthlyRent: 690000,
    deposit: 0, annualMileageKm: 20000, policyValues: [],
  }],
  productPolicies: [], sourceSnapshotId: 'snap-1', updatedAt: '2026-09-25T00:00:00.000Z',
} as CanonicalProduct;

const shadowLegacy = {
  ...legacy,
  async list() { return [shadowProduct]; },
  async get(id: string) { return id === shadowProduct.id ? shadowProduct : null; },
};
const meta = {
  consumerId: 'freepass-admin-catalog' as const,
  projectionId: 'admin-catalog' as const,
  authority: 'CANONICAL_ACTIVE' as const,
  schemaVersion: '1.0.0' as const,
  releaseId: 'rel_admin_1', manifestId: 'manifest_rel_admin_1',
  inputDigest: 'input', dataDigest: 'data', revision: 1,
  generatedAt: '2026-09-25T00:00:00.000Z', activatedAt: '2026-09-25T00:01:00.000Z',
  policyParity: 'COMPLETE' as const, missingPolicyOfferIds: [], invalidPolicyFactRefs: [],
};

test('SHADOW_READ compares FreePass Data but keeps legacy rows as user output', async () => {
  const freepass = {
    async list() { return { rows: [structuredClone(shadowProduct)], meta }; },
    async get() { return structuredClone(shadowProduct); },
  };
  const reader = new AdminCatalogSwitchboard(shadowLegacy, freepass, () => 'SHADOW_READ');
  const result = await reader.list();
  assert.equal(result.receipt.shadow?.status, 'MATCH');
  assert.deepEqual(result.receipt.holdReasons, []);
  assert.equal(result.receipt.freepass?.releaseId, 'rel_admin_1');
  assert.equal(result.rows[0]?.sourceSnapshotId, 'snap-1');
});

test('SHADOW_READ records mismatch and still returns the legacy result', async () => {
  const changed = structuredClone(shadowProduct);
  changed.offers[0]!.monthlyRent = 700000;
  const freepass = {
    async list() { return { rows: [changed], meta }; },
    async get() { return changed; },
  };
  const reader = new AdminCatalogSwitchboard(shadowLegacy, freepass, () => 'SHADOW_READ');
  const result = await reader.list();
  assert.equal(result.receipt.shadow?.status, 'MISMATCH');
  assert.deepEqual(result.receipt.holdReasons, ['FREEPASS_DATA_SHADOW_MISMATCH']);
  assert.equal(result.rows[0]?.offers[0]?.monthlyRent, 690000);
});

for (const mode of ['PARITY_VERIFIED','FREEPASS_DATA_READ'] as const) {
  test(`${mode} fails closed until parity/fallback/readback evidence exists`, async () => {
    const reader = new AdminCatalogSwitchboard(legacy, undefined, () => mode);
    await assert.rejects(() => reader.list(), (e: unknown) =>
      e instanceof FreePassDataCatalogHoldError && /fallback하지 않았다/.test(e.message));
    await assert.rejects(() => reader.get('P-1'), FreePassDataCatalogHoldError);
  });
}

test('unknown Admin Catalog read mode is rejected', () => {
  assert.throws(() => adminCatalogReadMode('DIRECT_FIRESTORE'), /모르는 프리패스 데이터/);
});
