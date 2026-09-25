import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { erp5 } from '../firestore';
import { Erp5ContractRepository } from '../contract-repository';
import { intakeEventDocId } from '../../../domain/settlement/code';

const emulatorHost=process.env.FIRESTORE_EMULATOR_HOST?.trim();
const emulatorTest=emulatorHost ? test : test.skip;
if(emulatorHost) process.env.ERP5_WRITE='on';

const effectiveDate='2026-09-25';

function ids(){
  const suffix=randomUUID().replace(/-/g,'').slice(0,16);
  return {contractId:`ctr_emu_${suffix}`,intakeId:`stl_emu_${suffix}`};
}

async function seed(overrides:{
  contract?:Record<string,unknown>;
  intake?:Record<string,unknown>;
}={}){
  const db=erp5();
  const {contractId,intakeId}=ids();
  const contract={
    source_intake_id:intakeId,
    contract_status:'계약완료',
    sign_status:'서명완료',
    esign_id:'esg_emulator',
    ...overrides.contract,
  };
  const intake={
    esignContractId:contractId,
    cancelled:false,
    delivered:true,
    deliveredAt:'2026-09-10',
    plate:`EMU${intakeId.slice(-8)}`,
    receivedAt:'2026-09-01',
    sourceProductId:`prod_${intakeId}`,
    intakeRequestId:`req_${intakeId}`,
    intakeIdentityMode:'product',
    ...overrides.intake,
  };
  await Promise.all([
    db.collection('contract').doc(contractId).set(contract),
    db.collection('settlement_rows').doc(intakeId).set(intake),
  ]);
  return {db,contractId,intakeId,contract,intake};
}

function operation(tag:string){
  return {
    effectiveDate,
    reason:`에뮬레이터 동시성 검증 ${tag}`,
    operationId:`terminate_emu_${tag}_1234567890abcdef`,
  };
}

emulatorTest('Firestore: 동일 계약해지 요청 2개가 동시에 와도 실제 write는 한 번만 확정된다',async()=>{
  const {db,contractId,intakeId}=await seed();
  const repo=new Erp5ContractRepository();
  const input=operation('same');

  const results=await Promise.all([
    repo.terminateContract(contractId,input,'emulator_a'),
    repo.terminateContract(contractId,input,'emulator_b'),
  ]);

  assert.deepEqual(results.map(r=>r.terminated).sort(),[false,true]);

  const [contractSnap,intakeSnap,eventSnap]=await Promise.all([
    db.collection('contract').doc(contractId).get(),
    db.collection('settlement_rows').doc(intakeId).get(),
    db.collection('contract_event').where('contractId','==',contractId).get(),
  ]);
  const contract=contractSnap.data()!;
  const intake=intakeSnap.data()!;
  assert.equal(contract.contract_status,'계약해지');
  assert.equal(contract.contract_termination_operation_id,input.operationId);
  assert.equal(intake.contractTerminationOperationId,input.operationId);
  assert.equal(contract.contract_terminated_at,intake.contractTerminatedAt);
  assert.equal(eventSnap.size,1);
});

emulatorTest('Firestore: 서로 다른 계약해지 요청이 경쟁하면 하나만 승리하고 후발 요청은 conflict로 끝난다',async()=>{
  const {db,contractId,intakeId}=await seed();
  const repo=new Erp5ContractRepository();
  const inputs=[operation('race_a'),operation('race_b')];

  const results=await Promise.allSettled(
    inputs.map((input,index)=>repo.terminateContract(contractId,input,`emulator_${index}`)),
  );
  const fulfilled=results
    .map((result,index)=>({result,index}))
    .filter((x):x is {result:PromiseFulfilledResult<Awaited<ReturnType<Erp5ContractRepository['terminateContract']>>>;index:number}=>x.result.status==='fulfilled');
  const rejected=results.filter((result):result is PromiseRejectedResult=>result.status==='rejected');

  assert.equal(fulfilled.length,1);
  assert.equal(rejected.length,1);
  assert.equal(fulfilled[0].result.value.terminated,true);
  assert.match(String(rejected[0].reason?.message??rejected[0].reason),/이미 계약해지/);

  const winner=inputs[fulfilled[0].index];
  const [contractSnap,intakeSnap,eventSnap]=await Promise.all([
    db.collection('contract').doc(contractId).get(),
    db.collection('settlement_rows').doc(intakeId).get(),
    db.collection('contract_event').where('contractId','==',contractId).get(),
  ]);
  assert.equal(contractSnap.data()!.contract_termination_operation_id,winner.operationId);
  assert.equal(intakeSnap.data()!.contractTerminationOperationId,winner.operationId);
  assert.equal(eventSnap.size,1);
});

emulatorTest('Firestore: audit event create가 실패하면 계약·접수·정산 audit write가 전부 rollback된다',async()=>{
  const {db,contractId,intakeId,intake}=await seed();
  const repo=new Erp5ContractRepository();
  const input=operation('rollback');
  const eventId='evt_'+createHash('sha256')
    .update(contractId+'|terminate|'+input.operationId)
    .digest('hex').slice(0,24);
  await db.collection('contract_event').doc(eventId).create({
    contractId,
    type:'collision-fixture',
  });

  await assert.rejects(
    repo.terminateContract(contractId,input,'emulator_rollback'),
  );

  const settlementEventId=intakeEventDocId(
    intake.plate,intake.sourceProductId,intake.receivedAt,
    intake.intakeRequestId,intake.intakeIdentityMode,
  );
  const [contractSnap,intakeSnap,settlementEventSnap]=await Promise.all([
    db.collection('contract').doc(contractId).get(),
    db.collection('settlement_rows').doc(intakeId).get(),
    db.collection('settlement_events').doc(settlementEventId).get(),
  ]);
  const contract=contractSnap.data()!;
  const row=intakeSnap.data()!;
  assert.equal(contract.contract_status,'계약완료');
  assert.equal('contract_terminated_at' in contract,false);
  assert.equal('contractTerminationDate' in row,false);
  assert.equal(settlementEventSnap.exists,false);
});

emulatorTest('Firestore: 계약/접수 한쪽만 해지된 partial state는 자동 덮어쓰기 없이 유지된다',async()=>{
  const input=operation('partial');
  const {db,contractId,intakeId}=await seed({
    intake:{
      contractTerminatedAt:100,
      contractTerminationDate:input.effectiveDate,
      contractTerminationReason:input.reason,
      contractTerminationOperationId:input.operationId,
    },
  });
  const repo=new Erp5ContractRepository();

  await assert.rejects(
    repo.terminateContract(contractId,input,'emulator_partial'),
    /계약과 접수.*일치하지/,
  );

  const [contractSnap,intakeSnap,eventSnap]=await Promise.all([
    db.collection('contract').doc(contractId).get(),
    db.collection('settlement_rows').doc(intakeId).get(),
    db.collection('contract_event').where('contractId','==',contractId).get(),
  ]);
  assert.equal(contractSnap.data()!.contract_status,'계약완료');
  assert.equal(intakeSnap.data()!.contractTerminatedAt,100);
  assert.equal(eventSnap.size,0);
});
