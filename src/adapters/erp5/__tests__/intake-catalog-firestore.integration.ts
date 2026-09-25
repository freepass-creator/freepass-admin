import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { erp5 } from '../firestore';
import { Erp5SettlementRepository } from '../settlement-repository';
import { buildIntakeCatalogSnapshot } from '../../../domain/settlement/catalog-snapshot';
import type { IntakeInput } from '../../../domain/settlement/intake';
import type { CanonicalProduct, Offer } from '../../../domain/product/types';

const emulatorHost=process.env.FIRESTORE_EMULATOR_HOST?.trim();
const emulatorTest=emulatorHost ? test : test.skip;
if(emulatorHost) process.env.ERP5_WRITE='on';

const product=(id:string):CanonicalProduct=>({
  id,
  version:7,
  supplierId:'SUP-A',
  supplierName:'공급사A',
  productKind:'중고렌트',
  supplierProductKey:id,
  vehicle:{
    nodeId:'node-1',originId:'KR',manufacturerId:'현대',modelId:'그랜저',
    subModelId:'GN7',trimId:'캘리그래피',matchLevel:'TRIM',
  },
  specs:{modelYear:2024,mileageKm:32_000,fuel:'가솔린'},
  registration:{vehicleNumber:`EMU${id.slice(-7)}`},
  offers:[],
  productPolicies:[{policyId:'min-age',type:'NUMBER',value:26}],
  sourceSnapshotId:'source-v7',
  updatedAt:'2026-09-25T00:00:00.000Z',
});
const offer=(id:string,rent:number):Offer=>({
  id,termMonths:36,monthlyRent:rent,deposit:1_000_000,annualMileageKm:20_000,
  policyValues:[{policyId:'min-age',type:'NUMBER',value:21}],
});

async function seedFeeRules(){
  const db=erp5();
  await Promise.all([
    db.collection('settlement_fee_rules').doc('emu-flat').set({
      seq:1,supplier:'공급사A',kind:'재렌트',form:'',term:36,
      basis:'정액',claim:1_000,pay:800,when:'',auto:true,
    }),
    db.collection('settlement_rules').doc('current').set({
      aliases:{},evModel:'$^',kindRules:[],version:'emu-v1',
    }),
  ]);
}

function intake(p:CanonicalProduct,o:Offer):IntakeInput{
  const snapshot=buildIntakeCatalogSnapshot(p,o,'2026-09-25T10:00:00.000Z');
  return {
    receivedAt:'2026-09-25',
    plate:p.registration?.vehicleNumber??'',
    model:`${p.vehicle.modelId} ${p.vehicle.subModelId}`,
    supplier:p.supplierName??p.supplierId,
    supplierCode:p.supplierId,
    customer:'에뮬레이터 고객',
    channel:'프리패스',
    channelCode:'FP',
    agent:'테스터',
    agentCode:'T1',
    product:'장기렌트',
    rentKind:'재렌트',
    contractType:'전자약정',
    term:o.termMonths,
    rent:o.monthlyRent,
    deposit:o.deposit??null,
    price:p.consumerPrice??null,
    payKind:'일시납',
    intakeRequestId:`req_${randomUUID().replace(/-/g,'')}`,
    sourceProductId:p.id,
    sourceProductVersion:p.version,
    sourceOfferId:o.id,
    sourceSnapshotId:p.sourceSnapshotId,
    catalogSnapshotDigest:snapshot.digest,
    catalogSnapshot:snapshot,
    paper:false,delivered:false,deliveredAt:'',note:'',
  };
}

emulatorTest('Firestore: same sealed Product/Offer retry creates exactly one intake',async()=>{
  await seedFeeRules();
  const suffix=randomUUID().replace(/-/g,'').slice(0,12);
  const p=product(`product_${suffix}`);
  const o=offer('offer-36',690_000);
  const input=intake(p,o);
  const repo=new Erp5SettlementRepository();

  const first=await repo.createIntake(input);
  const second=await repo.createIntake({...input,intakeRequestId:`retry_${suffix}`});

  assert.equal(first.created,true);
  assert.equal(second.created,false);
  assert.equal(second.code,first.code);

  const doc=await erp5().collection('settlement_rows').doc(first.code).get();
  assert.equal(doc.exists,true);
  assert.equal(doc.data()?.sourceProductId,p.id);
  assert.equal(doc.data()?.sourceOfferId,o.id);
  assert.equal(doc.data()?.sourceProductVersion,p.version);
  assert.equal(doc.data()?.sourceSnapshotId,p.sourceSnapshotId);
  assert.equal(doc.data()?.catalogSnapshotDigest,input.catalogSnapshotDigest);
  assert.deepEqual(doc.data()?.catalogSnapshot,input.catalogSnapshot);
});

emulatorTest('Firestore: same product/day with a different Offer is conflict, not idempotent reuse',async()=>{
  await seedFeeRules();
  const suffix=randomUUID().replace(/-/g,'').slice(0,12);
  const p=product(`product_${suffix}`);
  const firstInput=intake(p,offer('offer-36',690_000));
  const changedInput=intake(p,offer('offer-48',750_000));
  const repo=new Erp5SettlementRepository();

  const first=await repo.createIntake(firstInput);
  await assert.rejects(
    repo.createIntake(changedInput),
    /Offer 불일치|Catalog snapshot digest 불일치/,
  );

  const docs=await erp5().collection('settlement_rows')
    .where('receivedAt','==','2026-09-25').get();
  const mine=docs.docs.filter((d)=>d.data().sourceProductId===p.id);
  assert.equal(mine.length,1);
  assert.equal(mine[0].id,first.code);
  assert.equal(mine[0].data().sourceOfferId,'offer-36');
});

emulatorTest('Firestore: product intake without a sealed snapshot is rejected before write',async()=>{
  await seedFeeRules();
  const suffix=randomUUID().replace(/-/g,'').slice(0,12);
  const p=product(`product_${suffix}`);
  const input=intake(p,offer('offer-36',690_000));
  const repo=new Erp5SettlementRepository();

  await assert.rejects(
    repo.createIntake({...input,catalogSnapshot:undefined,catalogSnapshotDigest:undefined}),
    /sealed Product\/Offer snapshot/,
  );

  const docs=await erp5().collection('settlement_rows')
    .where('receivedAt','==','2026-09-25').get();
  assert.equal(docs.docs.some((d)=>d.data().sourceProductId===p.id),false);
});
