import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalProduct, Offer } from '../product/types';
import { matchProduct } from './match-product';

const now='2026-09-20T00:00:00.000Z';

function offer(partial:Partial<Offer>&Pick<Offer,'id'|'termMonths'|'monthlyRent'>):Offer{
  return {policyValues:[],...partial};
}
function product(partial:Partial<CanonicalProduct>&Pick<CanonicalProduct,'id'|'vehicle'>):CanonicalProduct{
  return {
    version:1,
    supplierId:'supplier-a',
    supplierProductKey:`${partial.id}-key`,
    specs:{},
    offers:[offer({id:`${partial.id}-36`,termMonths:36,monthlyRent:690000,deposit:0,annualMileageKm:20000})],
    productPolicies:[],
    sourceSnapshotId:`${partial.id}-source`,
    updatedAt:now,
    ...partial,
  };
}

const modelOnly=product({
  id:'sonata-model',
  vehicle:{nodeId:'sonata',originId:'kr',manufacturerId:'hyundai',modelId:'sonata',matchLevel:'MODEL'},
});
const dn8=product({
  id:'sonata-dn8',
  vehicle:{nodeId:'sonata-dn8',originId:'kr',manufacturerId:'hyundai',modelId:'sonata',subModelId:'dn8',trimId:'inspiration',matchLevel:'TRIM'},
});
const edge=product({
  id:'sonata-edge',
  vehicle:{nodeId:'sonata-edge',originId:'kr',manufacturerId:'hyundai',modelId:'sonata',subModelId:'edge',matchLevel:'SUB_MODEL'},
});

const mixed=product({
  id:'mixed',
  vehicle:dn8.vehicle,
  offers:[
    offer({id:'o18',termMonths:18,monthlyRent:700000,deposit:3000000,annualMileageKm:20000}),
    offer({
      id:'o36',termMonths:36,monthlyRent:650000,deposit:0,annualMileageKm:30000,
      policyValues:[{policyId:'pay-time',type:'SINGLE_SELECT',value:'POSTPAID'}],
    }),
    offer({id:'o60',termMonths:60,monthlyRent:590000,deposit:0,annualMileageKm:20000}),
  ],
  productPolicies:[
    {policyId:'min-age',type:'NUMBER',value:21},
    {policyId:'pay-method',type:'MULTI_SELECT',value:['CARD','TRANSFER']},
  ],
});

test('model search includes confirmed descendants and marks deeper unknown as PARTIAL',()=>{
  assert.equal(matchProduct(modelOnly,{modelIds:['sonata']})?.vehicleMatch.level,'EXACT');
  assert.equal(matchProduct(dn8,{modelIds:['sonata']})?.vehicleMatch.level,'EXACT');
  assert.equal(matchProduct(modelOnly,{modelIds:['sonata'],subModelIds:['dn8']})?.vehicleMatch.level,'PARTIAL');
  assert.equal(matchProduct(edge,{modelIds:['sonata'],subModelIds:['dn8']}),null);
});

test('offer filters must be satisfied by the same offer',()=>{
  assert.equal(matchProduct(mixed,{
    termMonths:[18],
    monthlyRent:{max:750000},
    deposit:{max:0},
  }),null);

  const hit=matchProduct(mixed,{
    termMonths:[36],
    monthlyRent:{max:660000},
    deposit:{max:0},
    annualMileageKm:{min:30000,max:30000},
  });
  assert.deepEqual(hit?.matchedOfferIds,['o36']);
});

test('unknown deposit is not treated as zero',()=>{
  const unknown=product({
    id:'unknown-deposit',
    vehicle:dn8.vehicle,
    offers:[offer({id:'unknown',termMonths:36,monthlyRent:650000,deposit:undefined})],
  });
  assert.equal(matchProduct(unknown,{deposit:{max:0}}),null);
  assert.deepEqual(matchProduct(unknown,{termMonths:[36]})?.matchedOfferIds,['unknown']);
});

test('product and offer policy resolution is explicit and offer overrides same policy id',()=>{
  assert.ok(matchProduct(mixed,{policies:[{policyId:'min-age',anyOf:[21]}]}));
  assert.ok(matchProduct(mixed,{policies:[{policyId:'pay-method',anyOf:['CARD']}]}));
  assert.deepEqual(
    matchProduct(mixed,{termMonths:[36],policies:[{policyId:'pay-time',anyOf:['POSTPAID']}]})?.matchedOfferIds,
    ['o36'],
  );

  const overridden=product({
    id:'override',
    vehicle:dn8.vehicle,
    productPolicies:[{policyId:'pay-time',type:'SINGLE_SELECT',value:'PREPAID'}],
    offers:[offer({
      id:'override-36',termMonths:36,monthlyRent:650000,deposit:0,
      policyValues:[{policyId:'pay-time',type:'SINGLE_SELECT',value:'POSTPAID'}],
    })],
  });
  assert.ok(matchProduct(overridden,{policies:[{policyId:'pay-time',anyOf:['POSTPAID']}]}));
  assert.equal(matchProduct(overridden,{policies:[{policyId:'pay-time',anyOf:['PREPAID']}]}),null);
});
