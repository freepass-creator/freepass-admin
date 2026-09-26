import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalProduct } from '../../../domain/product/types';
import { AdminCatalogSwitchboard, FreePassDataCatalogHoldError, adminCatalogReadMode, compareAdminCatalogShadow } from '../admin-catalog-reader';
import type { AdminCutoverDecision, AdminCutoverStage } from '../../../shared/freepass-data-admin-cutover';

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
  const reader = new AdminCatalogSwitchboard(legacy, undefined, () => 'SHADOW_READ', () => cutover('SHADOW_READ'));
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

const cutover = (targetStage: AdminCutoverStage, override?: Partial<{
  releaseId:string; manifestId:string; inputDigest:string; dataDigest:string;
}>): AdminCutoverDecision => ({
  ok:true,
  approval:{
    consumerId:'freepass-admin-catalog',
    fromStage:targetStage==='SHADOW_READ'?'OBSERVE':targetStage==='PARITY_VERIFIED'?'SHADOW_READ':'PARITY_VERIFIED',
    targetStage,
    baseOrigin:'https://data.example.test',
    tokenSha256:'a'.repeat(64),
    evidence:{
      contractReady:true,
      authenticationVerified:true,
      legacyReadVerified:true,
      freepassReadVerified:true,
      parityVerified:targetStage!=='SHADOW_READ',
      fallbackVerified:targetStage==='FREEPASS_DATA_READ',
      productionReadbackVerified:targetStage==='FREEPASS_DATA_READ',
      approvedRelease:targetStage==='SHADOW_READ'?null:{
        projectionId:'admin-catalog',
        releaseId:override?.releaseId??meta.releaseId,
        manifestId:override?.manifestId??meta.manifestId,
        inputDigest:override?.inputDigest??meta.inputDigest,
        dataDigest:override?.dataDigest??meta.dataDigest,
        observedAt:'2026-09-25T00:02:00.000Z',
      },
    },
    holdReasons:[],
    approvalRef:'cutover-test',
    approvedAt:'2026-09-25T00:03:00.000Z',
    validUntil:'2026-10-25T00:03:00.000Z',
  },
});

test('SHADOW_READ compares FreePass Data but keeps legacy rows as user output', async () => {
  const freepass = {
    async list() { return { rows: [structuredClone(shadowProduct)], meta }; },
    async get() { return structuredClone(shadowProduct); },
  };
  const reader = new AdminCatalogSwitchboard(shadowLegacy, freepass, () => 'SHADOW_READ', () => cutover('SHADOW_READ'));
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
  const reader = new AdminCatalogSwitchboard(shadowLegacy, freepass, () => 'SHADOW_READ', () => cutover('SHADOW_READ'));
  const result = await reader.list();
  assert.equal(result.receipt.shadow?.status, 'MISMATCH');
  assert.deepEqual(result.receipt.holdReasons, ['FREEPASS_DATA_SHADOW_MISMATCH']);
  assert.equal(result.rows[0]?.offers[0]?.monthlyRent, 690000);
});

for (const mode of ['PARITY_VERIFIED','FREEPASS_DATA_READ'] as const) {
  test(`${mode} fails closed without a cutover approval receipt`, async () => {
    const reader = new AdminCatalogSwitchboard(legacy, undefined, () => mode, () => ({ok:false,reason:'missing evidence'}));
    await assert.rejects(() => reader.list(), FreePassDataCatalogHoldError);
    await assert.rejects(() => reader.get('P-1'), FreePassDataCatalogHoldError);
  });
}

test('PARITY_VERIFIED rechecks approved release and shadow parity but keeps legacy output', async () => {
  const changed = structuredClone(shadowProduct);
  changed.updatedAt = '2026-09-25T00:05:00.000Z';
  const freepass = {
    async list() { return { rows: [changed], meta }; },
    async get() { return changed; },
  };
  const reader = new AdminCatalogSwitchboard(
    shadowLegacy, freepass, () => 'PARITY_VERIFIED', () => cutover('PARITY_VERIFIED'),
  );
  const result = await reader.list();
  assert.equal(result.receipt.shadow?.status,'MATCH');
  assert.equal(result.receipt.servedBy,'LEGACY_ERP5_BRIDGE');
  assert.equal(result.receipt.cutoverAuthorized,false);
  assert.equal(result.rows[0]?.updatedAt,shadowProduct.updatedAt);
});

test('FREEPASS_DATA_READ serves Data only when approval, release identity and live parity all match', async () => {
  const changed = structuredClone(shadowProduct);
  changed.updatedAt = '2026-09-25T00:05:00.000Z';
  const freepass = {
    async list() { return { rows: [changed], meta }; },
    async get() { return changed; },
  };
  const reader = new AdminCatalogSwitchboard(
    shadowLegacy, freepass, () => 'FREEPASS_DATA_READ', () => cutover('FREEPASS_DATA_READ'),
  );
  const result = await reader.list();
  assert.equal(result.receipt.servedBy,'FREEPASS_DATA');
  assert.equal(result.receipt.cutoverAuthorized,true);
  assert.equal(result.receipt.cutover?.approvalRef,'cutover-test');
  assert.equal(result.receipt.cutover?.targetStage,'FREEPASS_DATA_READ');
  assert.equal(result.rows[0]?.updatedAt,'2026-09-25T00:05:00.000Z');
  assert.equal((await reader.get('P-1'))?.updatedAt,'2026-09-25T00:05:00.000Z');
});

test('FREEPASS_DATA_READ fails closed when current ACTIVE release differs from the approved release', async () => {
  const freepass = {
    async list() { return { rows: [structuredClone(shadowProduct)], meta }; },
    async get() { return structuredClone(shadowProduct); },
  };
  const reader = new AdminCatalogSwitchboard(
    shadowLegacy, freepass, () => 'FREEPASS_DATA_READ',
    () => cutover('FREEPASS_DATA_READ',{dataDigest:'approved-old-digest'}),
  );
  await assert.rejects(() => reader.list(), (e:unknown) =>
    e instanceof FreePassDataCatalogHoldError && /APPROVED_RELEASE_MISMATCH/.test(e.message));
});

test('unknown Admin Catalog read mode is rejected', () => {
  assert.throws(() => adminCatalogReadMode('DIRECT_FIRESTORE'), /모르는 프리패스 데이터/);
});


test('shadow parity detects intake-critical price, vehicle, and policy drift', () => {
  const cases: Array<[string,(p: CanonicalProduct)=>void]> = [
    ['consumer price', (p) => { p.consumerPrice = 48_000_000; }],
    ['prepayment', (p) => { p.offers[0]!.prepayment = 500_000; }],
    ['trim', (p) => { p.vehicle.trimId = 'CALLIGRAPHY'; }],
    ['offer policy', (p) => { p.offers[0]!.policyValues = [{ policyId:'min-age',type:'NUMBER',value:26 }]; }],
    ['product policy', (p) => { p.productPolicies = [{ policyId:'license',type:'TEXT',value:'1년 이상' }]; }],
  ];
  for (const [name, mutate] of cases) {
    const changed = structuredClone(shadowProduct);
    mutate(changed);
    assert.equal(compareAdminCatalogShadow([shadowProduct], [changed]).status, 'MISMATCH', name);
  }
});

test('shadow parity ignores policy list ordering but not policy values', () => {
  const left = structuredClone(shadowProduct);
  left.productPolicies = [
    { policyId:'a',type:'MULTI_SELECT',value:['B','A'] },
    { policyId:'b',type:'NUMBER',value:21 },
  ];
  const right = structuredClone(left);
  right.productPolicies.reverse();
  (right.productPolicies[1] as { policyId:string; type:'MULTI_SELECT'; value:string[] }).value.reverse();
  assert.equal(compareAdminCatalogShadow([left], [right]).status, 'MATCH');
});


test('FREEPASS_DATA_READ no longer depends on legacy reader availability after cutover', async () => {
  const brokenLegacy = {
    ...legacy,
    async list(): Promise<CanonicalProduct[]> { throw new Error('legacy unavailable'); },
    async get(): Promise<CanonicalProduct|null> { throw new Error('legacy unavailable'); },
  };
  const freepass = {
    async list() { return { rows: [structuredClone(shadowProduct)], meta }; },
    async get() { return structuredClone(shadowProduct); },
  };
  const reader = new AdminCatalogSwitchboard(
    brokenLegacy, freepass, () => 'FREEPASS_DATA_READ', () => cutover('FREEPASS_DATA_READ'),
  );
  const result = await reader.list();
  assert.equal(result.rows[0]?.id,'P-1');
  assert.equal(result.receipt.servedBy,'FREEPASS_DATA');
});
