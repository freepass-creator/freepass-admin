import assert from 'node:assert/strict';
import test from 'node:test';
import { createApplication } from '../domain/application/create-application';
import { updateApplicationProgress } from '../domain/application/update-progress';
import { createPerformanceFromDelivery } from '../domain/performance/performance';
import type { CanonicalProduct } from '../domain/product/types';
import {
  buildF04Projection,
  f04AdminOwnedPatch,
  f04ProgressPatch,
  f04SettlementCode,
} from './f04-bridge';

const t0='2026-09-21T00:00:00.000Z';
const t1='2026-09-21T01:00:00.000Z';
const actor={id:'admin-1',type:'ADMIN' as const};

const product:CanonicalProduct={
  id:'p1',
  version:4,
  supplierId:'',
  supplierProductKey:'raw-1',
  commercialType:'USED_RENT',
  vehicle:{nodeId:'n1',originId:'KR',manufacturerId:'현대',modelId:'싼타페',subModelId:'MX5',matchLevel:'SUB_MODEL'},
  specs:{modelYear:2026},
  registration:{vehicleNumber:'123하4567'},
  offers:[{
    id:'offer-1#36_2만',
    supplierId:'supplier-a',
    sourceOfferId:'offer-1',
    sourceOfferRevision:8,
    sourcePriceTermKey:'36_2만',
    termMonths:36,
    monthlyRent:920000,
    deposit:0,
    depositState:'ZERO',
    policyValues:[],
  }],
  productPolicies:[],
  sourceSnapshotId:'freepass-data:rel-1:p1:4',
  updatedAt:t0,
};

function delivered(){
  const app=createApplication({
    id:'application-123',
    applicationNumber:'A-260921-001',
    applicantName:'홍길동',
    salesChannelId:'channel-1',
    assigneeId:'admin-1',
    source:'ADMIN',
    product,
    offerId:'offer-1#36_2만',
    submissionId:'sub-1',
    actor,
    now:t0,
  });
  return updateApplicationProgress(app,'deliveryCompleted',true,t1,actor);
}

test('F04 code is deterministic from Admin application identity',()=>{
  const a=f04SettlementCode('application-123');
  const b=f04SettlementCode('application-123');
  assert.equal(a,b);
  assert.match(a,/^stl_[0-9a-f]{32}$/);
});

test('parallel mirror only emits Admin-owned fields and never transitional F04 facts',()=>{
  const application=delivered();
  const performance=createPerformanceFromDelivery(application);
  const projection=buildF04Projection({
    application,
    performance,
    labels:{
      supplierLabel:'웰릭스',
      salesChannelLabel:'하허호',
      assigneeLabel:'박관리',
    },
  });
  const patch=f04AdminOwnedPatch(projection,'MIRROR_ADMIN_OWNED');

  assert.equal(patch.차량번호,'123하4567');
  assert.equal(patch.공급사,'웰릭스');
  assert.equal(patch.영업채널,'하허호');
  assert.equal(patch.영업담당자,'박관리');
  assert.equal(patch.보증금,0);
  assert.equal(patch.인도완료,true);

  for(const protectedField of [
    '분납여부','청구월','다음회차일','환수','환수사유','환수일','환수금액',
    '공급사수수료율','에이전시수수료율','청구가감','지급가감','가감사유',
  ]){
    assert.equal(Object.prototype.hasOwnProperty.call(patch,protectedField),false,protectedField);
  }
});

test('OBSERVE mode cannot produce a write patch',()=>{
  const projection=buildF04Projection({application:delivered()});
  assert.deepEqual(f04AdminOwnedPatch(projection,'OBSERVE'),{});
});

test('UNKNOWN deposit is not mirrored as zero',()=>{
  const application=delivered();
  application.snapshot.offer.deposit=undefined;
  application.snapshot.offer.depositState='UNKNOWN';
  const patch=f04AdminOwnedPatch(buildF04Projection({application}),'MIRROR_ADMIN_OWNED');
  assert.equal(Object.prototype.hasOwnProperty.call(patch,'보증금'),false);
});

test('progress row uses stable settlement code and lifecycle facts',()=>{
  const application=delivered();
  const performance=createPerformanceFromDelivery(application);
  const projection=buildF04Projection({
    application,
    performance,
    labels:{supplierLabel:'웰릭스'},
  });
  const patch=f04ProgressPatch(projection);
  assert.equal(patch.정산코드,f04SettlementCode(application.id));
  assert.equal(patch.인도완료,'예');
  assert.equal(patch.청구상태,'실적 진행');
});
