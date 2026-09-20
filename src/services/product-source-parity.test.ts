import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalProduct } from '../domain/product/types';
import { compareProductSources, parityClean } from './product-source-parity';

const base:CanonicalProduct={
  id:'p1',
  version:1,
  supplierId:'supplier-a',
  supplierProductKey:'legacy-key',
  vehicle:{
    nodeId:'node-1',
    originId:'KR',
    manufacturerId:'현대',
    modelId:'싼타페',
    subModelId:'MX5',
    trimId:'캘리그래피',
    matchLevel:'TRIM',
  },
  specs:{modelYear:2026,mileageKm:20000,fuel:'하이브리드',seats:6,drivetrain:'AWD'},
  registration:{vehicleNumber:'123하4567',vin:'VIN-1'},
  offers:[{
    id:'legacy#36_2만',
    termMonths:36,
    monthlyRent:920000,
    deposit:0,
    depositState:'ZERO',
    annualMileageKm:20000,
    policyValues:[{policyId:'basic_driver_age',type:'NUMBER',value:21}],
  }],
  productPolicies:[{policyId:'deposit_card_payment',type:'BOOLEAN',value:true}],
  sourceSnapshotId:'legacy:1',
  updatedAt:'2026-09-20T00:00:00.000Z',
};

test('parity ignores source ids/revisions while comparing Admin consumer semantics',()=>{
  const data:CanonicalProduct={
    ...base,
    version:99,
    supplierId:'',
    supplierProductKey:'data-key',
    sourceSnapshotId:'freepass-data:rel-1:p1:99',
    updatedAt:'2026-09-21T00:00:00.000Z',
    offers:[{
      ...base.offers[0],
      id:'offer-canonical#36_2만',
      supplierId:'supplier-a',
      sourceOfferId:'offer-canonical',
      sourceOfferRevision:8,
      sourcePriceTermKey:'36_2만',
    }],
  };
  const report=compareProductSources([base],[data]);
  assert.equal(parityClean(report),true);
  assert.equal(report.matchedProducts,1);
  assert.deepEqual(report.issues,[]);
});

test('parity detects missing extra and semantic product differences',()=>{
  const changed:CanonicalProduct={
    ...base,
    offers:[{...base.offers[0],monthlyRent:930000}],
  };
  const extra:CanonicalProduct={...base,id:'p2'};
  const report=compareProductSources([base],[changed,extra]);
  assert.equal(parityClean(report),false);
  assert.equal(report.semanticMismatch,1);
  assert.equal(report.extraInData,1);
  assert.ok(report.issues.some((issue)=>issue.kind==='PRODUCT_MISMATCH'&&issue.fields.includes('offers')));
  assert.ok(report.issues.some((issue)=>issue.kind==='EXTRA_IN_DATA'&&issue.productId==='p2'));
});

test('deposit UNKNOWN and ZERO are different even when both could lack a positive amount',()=>{
  const unknown:CanonicalProduct={
    ...base,
    offers:[{
      ...base.offers[0],
      deposit:undefined,
      depositState:'UNKNOWN',
    }],
  };
  const report=compareProductSources([base],[unknown]);
  assert.equal(report.semanticMismatch,1);
  assert.ok(report.issues.some((issue)=>issue.kind==='PRODUCT_MISMATCH'&&issue.fields.includes('offers')));
});
