import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalProduct } from '../product/types';
import { createApplication } from './create-application';

const now='2026-09-20T00:00:00.000Z';
const product:CanonicalProduct={
  id:'product-1',
  version:7,
  supplierId:'supplier-1',
  supplierProductKey:'supplier-key-1',
  vehicle:{nodeId:'node-1',originId:'kr',manufacturerId:'hyundai',modelId:'sonata',matchLevel:'MODEL'},
  specs:{modelYear:2026,seats:5},
  registration:{vehicleNumber:'12가3456',vin:'VIN-ORIGINAL'},
  offers:[{
    id:'offer-36',termMonths:36,monthlyRent:650000,deposit:0,annualMileageKm:20000,
    policyValues:[{policyId:'pay-method',type:'MULTI_SELECT',value:['CARD','TRANSFER']}],
  }],
  productPolicies:[{policyId:'min-age',type:'NUMBER',value:21}],
  sourceSnapshotId:'source-7',
  updatedAt:now,
};

function create(over:Record<string,unknown>={}){
  return createApplication({
    id:'app-1',
    applicationNumber:'A-260920-001',
    applicantName:'홍길동',
    salesChannelId:'channel-1',
    assigneeId:'admin-1',
    source:'ADMIN',
    product,
    offerId:'offer-36',
    submissionId:'submission-1',
    actor:{id:'admin-1',type:'ADMIN'},
    now,
    ...over,
  } as Parameters<typeof createApplication>[0]);
}

test('intake requires selected offer, sales channel, assignee and applicant name while phone is optional',()=>{
  const app=create();
  assert.equal(app.applicantName,'홍길동');
  assert.equal(app.salesChannelId,'channel-1');
  assert.equal(app.assigneeId,'admin-1');
  assert.equal(app.snapshot.offer.id,'offer-36');
  assert.equal(app.applicantPhone,undefined);

  assert.throws(()=>create({applicantName:' '}),/applicantName is required/);
  assert.throws(()=>create({salesChannelId:' '}),/salesChannelId is required/);
  assert.throws(()=>create({assigneeId:' '}),/assigneeId is required/);
  assert.throws(()=>create({submissionId:' '}),/submissionId is required/);
});

test('intake snapshot pins product version and deep-clones mutable policy arrays',()=>{
  const app=create();
  assert.equal(app.snapshot.productVersion,7);
  const sourcePolicy=product.offers[0].policyValues[0];
  const savedPolicy=app.snapshot.offer.policyValues[0];
  if(sourcePolicy.type!=='MULTI_SELECT'||savedPolicy.type!=='MULTI_SELECT') throw new Error('fixture');
  sourcePolicy.value.push('CASH');
  assert.deepEqual(savedPolicy.value,['CARD','TRANSFER']);
  sourcePolicy.value.pop();
});

test('registration facts are snapshotted and isolated from later product changes',()=>{
  const app=create();
  assert.equal(app.snapshot.registration?.vehicleNumber,'12가3456');
  product.registration!.vehicleNumber='99나9999';
  assert.equal(app.snapshot.registration?.vehicleNumber,'12가3456');
  product.registration!.vehicleNumber='12가3456';
});

test('selected offer must belong to the product',()=>{
  assert.throws(()=>create({offerId:'other-offer'}),/Selected offer/);
});
