import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntakeCatalogSnapshot, catalogRetryConflict, intakeCatalogSnapshotDigest } from '../catalog-snapshot';
import type { CanonicalProduct, Offer } from '../../product/types';

const offer=(partial:Partial<Offer>={}):Offer=>({
  id:'offer-36',
  termMonths:36,
  monthlyRent:690_000,
  deposit:1_000_000,
  annualMileageKm:20_000,
  policyValues:[{policyId:'min-age',type:'NUMBER',value:21}],
  ...partial,
});

const product=(partial:Partial<CanonicalProduct>={}):CanonicalProduct=>({
  id:'product-1',
  version:7,
  supplierId:'SUP-1',
  supplierName:'공급사A',
  productKind:'중고렌트',
  status:'즉시출고',
  consumerPrice:40_000_000,
  supplierProductKey:'raw-1',
  vehicle:{
    nodeId:'node-1',originId:'KR',manufacturerId:'현대',modelId:'그랜저',
    subModelId:'GN7',trimId:'캘리그래피',matchLevel:'TRIM',
  },
  specs:{modelYear:2024,mileageKm:32_000,fuel:'가솔린',seats:5},
  registration:{vehicleNumber:'12가3456',vin:'VIN1',firstRegistrationDate:'2024-01-02'},
  offers:[offer()],
  productPolicies:[
    {policyId:'min-age',type:'NUMBER',value:26},
    {policyId:'docs',type:'MULTI_SELECT',value:['면허증','등본']},
  ],
  sourceSnapshotId:'source-snap-7',
  updatedAt:'2026-09-25T00:00:00.000Z',
  ...partial,
});

test('sealed intake snapshot preserves product policy, offer policy, and resolved policy separately',()=>{
  const p=product();
  const o=offer();
  const s=buildIntakeCatalogSnapshot(p,o,'2026-09-25T10:00:00.000Z');

  assert.deepEqual(s.product.policyValues,p.productPolicies);
  assert.deepEqual(s.offer.policyValues,o.policyValues);
  assert.deepEqual(
    s.offer.resolvedPolicyValues?.find((x)=>x.policyId==='min-age'),
    {policyId:'min-age',type:'NUMBER',value:21},
  );
  assert.equal(s.product.status,'즉시출고');
  assert.equal(s.product.specs?.mileageKm,32_000);
  assert.equal(s.product.consumerPrice,40_000_000);
  assert.match(String(s.digest),/^[a-f0-9]{64}$/);
});

test('snapshot digest ignores capture time but changes when selected offer changes',()=>{
  const p=product();
  const a=buildIntakeCatalogSnapshot(p,offer(),'2026-09-25T10:00:00.000Z');
  const b=buildIntakeCatalogSnapshot(p,offer(),'2026-09-25T11:00:00.000Z');
  const c=buildIntakeCatalogSnapshot(p,offer({monthlyRent:700_000}),'2026-09-25T11:00:00.000Z');

  assert.equal(a.digest,b.digest);
  assert.notEqual(a.digest,c.digest);
  assert.equal(a.digest,intakeCatalogSnapshotDigest(a));
});

test('snapshot clones multi-select policy arrays so later source mutation cannot rewrite intake snapshot',()=>{
  const p=product();
  const o=offer();
  const s=buildIntakeCatalogSnapshot(p,o,'2026-09-25T10:00:00.000Z');
  const docs=p.productPolicies.find((x)=>x.policyId==='docs');
  if(docs?.type==='MULTI_SELECT')docs.value.push('추가서류');

  const frozen=s.product.policyValues?.find((x)=>x.policyId==='docs');
  assert.deepEqual(frozen,{policyId:'docs',type:'MULTI_SELECT',value:['면허증','등본']});
});

test('duplicate product intake is idempotent only for the same product/version/offer/source/digest',()=>{
  const snapshot=buildIntakeCatalogSnapshot(product(),offer(),'2026-09-25T10:00:00.000Z');
  const existing={
    sourceProductId:'product-1',
    sourceProductVersion:7,
    sourceOfferId:'offer-36',
    sourceSnapshotId:'source-snap-7',
    catalogSnapshotDigest:snapshot.digest,
    catalogSnapshot:snapshot,
  };
  const same={
    sourceProductId:'product-1',
    sourceProductVersion:7,
    sourceOfferId:'offer-36',
    sourceSnapshotId:'source-snap-7',
    catalogSnapshotDigest:snapshot.digest,
  };
  assert.equal(catalogRetryConflict(existing,same),null);
  assert.match(String(catalogRetryConflict(existing,{...same,sourceOfferId:'offer-48'})),/Offer 불일치/);
  assert.match(String(catalogRetryConflict(existing,{...same,sourceProductVersion:8})),/Product version 불일치/);
  assert.match(String(catalogRetryConflict(existing,{...same,catalogSnapshotDigest:'different'})),/Catalog snapshot digest 불일치/);
});

test('legacy stored snapshot can derive its digest for safe retry comparison',()=>{
  const snapshot=buildIntakeCatalogSnapshot(product(),offer(),'2026-09-25T10:00:00.000Z');
  const {digest: _digest,...legacy}=snapshot;
  const existing={
    sourceProductId:'product-1',
    sourceProductVersion:7,
    sourceOfferId:'offer-36',
    sourceSnapshotId:'source-snap-7',
    catalogSnapshot:legacy,
  };
  const incoming={
    sourceProductId:'product-1',
    sourceProductVersion:7,
    sourceOfferId:'offer-36',
    sourceSnapshotId:'source-snap-7',
    catalogSnapshotDigest:intakeCatalogSnapshotDigest(legacy),
  };
  assert.equal(catalogRetryConflict(existing,incoming),null);
});
