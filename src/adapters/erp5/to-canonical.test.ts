import assert from 'node:assert/strict';
import test from 'node:test';
import { indexMaster } from '../../domain/product/master-match';
import { offersOf, policyValuesOf, toCanonicalProduct } from './to-canonical';

test('ERP5 offer parser preserves unknown deposit instead of inventing zero',()=>{
  const parsed=offersOf({
    '36':{rent:'650,000'},
    '60_2만':{rent:590000,deposit:0},
  },'p1');
  assert.equal(parsed.offers[0].deposit,undefined);
  assert.equal(parsed.offers[1].deposit,0);
  assert.equal(parsed.offers[1].annualMileageKm,20000);
});

test('ERP5 human policy parser keeps 협의 as TEXT instead of false',()=>{
  const values=policyValuesOf({deposit_installment:'협의',basic_driver_age:'만 21세 이상'});
  assert.deepEqual(values.find(x=>x.policyId==='deposit_installment'),{policyId:'deposit_installment',type:'TEXT',value:'협의'});
  assert.deepEqual(values.find(x=>x.policyId==='basic_driver_age'),{policyId:'basic_driver_age',type:'NUMBER',value:21});
});

test('ERP5 mapper binds current master and source version into current CanonicalProduct',()=>{
  const master=indexMaster([{
    id:'hyundai-sonata-dn8',maker:'현대',model:'쏘나타',subModel:'DN8',aliases:[],trims:['인스퍼레이션'],yearStart:2024,yearEnd:null,
  }]);
  const result=toCanonicalProduct({
    car_number:'12가3456',
    product_code:'p-sonata',
    provider_company_code:'supplier-1',
    maker:'현대',model:'쏘나타',sub_model:'DN8',trim_name:'인스퍼레이션',year:2026,
    updatedAt:'2026-09-20T10:00:00Z',
    price:{'36_2만':{rent:690000,deposit:0}},
  },'12가3456',undefined,master);
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(result.product.vehicle.matchLevel,'TRIM');
  assert.equal(result.product.vehicle.nodeId,'hyundai-sonata-dn8');
  assert.equal(result.product.version,Date.parse('2026-09-20T10:00:00Z'));
  assert.equal(result.product.sourceSnapshotId,'erp5:12가3456:'+String(result.product.version));
});
