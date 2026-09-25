import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import { planContractTermination } from '../../../domain/contracts/termination';
import { contractIntakeLinkError } from '../../../domain/contracts/link';

// Execute the real adapter with isolated transaction doubles. No Firebase SDK,
// credentials, live writes, e-sign implementation or emulator is loaded here.
const sourcePath=resolve(process.cwd(),'src/adapters/erp5/contract-repository.ts');
const compiled=ts.transpileModule(readFileSync(sourcePath,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const now=Date.parse('2026-09-25T06:00:00Z');
const contractId='ctr_term_1';
const input={effectiveDate:'2026-09-25',reason:'고객 중도해지',operationId:'terminate_1234567890abcdef'};
type Ref={path:string};
type Write={method:string;path:string;data:Record<string,unknown>};
type Repository={terminateContract(id:string,payload:typeof input,actor:string):Promise<{
  terminated:boolean;effectiveDate:string;reason:string;
}>};

function fixture(overrides:Record<string,unknown>={}){
  const writes:Write[]=[];
  const intake={
    cancelled:false,delivered:true,deliveredAt:'2026-09-10',esignContractId:contractId,
    billed:true,claimStage:'확인',payStage:'통보',collectedAmt:200000,paidAmt:100000,
    ...overrides,
  };
  const documents=new Map<string,Record<string,unknown>>([
    [`contract/${contractId}`,{source_intake_id:'intake_1',contract_status:'계약완료',sign_status:'서명완료',esign_id:'esg_1'}],
    ['settlement_rows/intake_1',intake],
  ]);
  const record=(method:string,ref:Ref,data:Record<string,unknown>)=>{
    writes.push({method,path:ref.path,data:{...data}});
  };
  const transaction={
    get:async(ref:Ref)=>({exists:documents.has(ref.path),data:()=>documents.get(ref.path)}),
    update:(ref:Ref,data:Record<string,unknown>)=>record('update',ref,data),
    create:(ref:Ref,data:Record<string,unknown>)=>record('create',ref,data),
    set:(ref:Ref,data:Record<string,unknown>)=>record('set',ref,data),
  };
  const db={
    collection:(name:string)=>({doc:(id:string)=>({path:`${name}/${id}`})}),
    runTransaction:(callback:(tx:typeof transaction)=>Promise<unknown>)=>callback(transaction),
  };
  const dependencies:Record<string,unknown>={
    './firestore':{erp5:()=>db},
    './atom':{strOf:(v:unknown)=>String(v??'').trim(),numOrNull:()=>null},
    './settlement-repository':{writeEnabled:()=>true,WriteDisabledError:Error},
    'node:crypto':crypto,
    '../../domain/settlement/code':{intakeEventDocId:()=>'intake_events_1'},
    '../../domain/contracts/termination':{planContractTermination},
    '../../domain/contracts/cancellation':{planContractCancellation:()=>{throw new Error('Cancellation is outside this test.');}},
    '../../domain/contracts/link':{contractIntakeLinkError},
  };
  const module={exports:{} as {Erp5ContractRepository?:new()=>Repository}};
  runInNewContext(compiled,{
    module,exports:module.exports,
    Date:class extends Date {static now(){return now;}},
    require:(id:string)=>{
      assert.ok(Object.hasOwn(dependencies,id),`Unmocked adapter dependency: ${id}`);
      return dependencies[id];
    },
  },{filename:sourcePath,timeout:1000});
  assert.ok(module.exports.Erp5ContractRepository);
  return {repository:new module.exports.Erp5ContractRepository(),writes};
}

test('다른 계약에 연결된 접수는 해지·정산행·감사이력 쓰기를 모두 차단한다',async()=>{
  const {repository,writes}=fixture({esignContractId:'ctr_other'});
  await assert.rejects(repository.terminateContract(contractId,input,'admin_test'),/다른 계약/);
  assert.equal(writes.length,0);
});

test('연결 불일치는 동일 요청 재시도에서도 성공으로 숨기지 않는다',async()=>{
  const {repository,writes}=fixture({
    esignContractId:'ctr_other',contractTerminatedAt:now,
    contractTerminationDate:input.effectiveDate,contractTerminationReason:input.reason,
    contractTerminationOperationId:input.operationId,
  });
  await assert.rejects(repository.terminateContract(contractId,input,'admin_test'),/다른 계약/);
  assert.equal(writes.length,0);
});

test('정상 연결은 해지 사실과 감사이력만 기록하고 정산·서명 원본은 유지한다',async()=>{
  const {repository,writes}=fixture();
  const result=await repository.terminateContract(contractId,input,'admin_test');
  assert.equal(result.terminated,true);
  assert.equal(writes.length,4);
  assert.deepEqual(writes.map(w=>w.path.split('/')[0]),['contract','settlement_rows','contract_event','settlement_events']);
  const patch=writes.find(w=>w.path==='settlement_rows/intake_1')!.data;
  assert.equal(patch.contractTerminationContractId,contractId);
  for(const field of ['billed','claimStage','payStage','collectedAmt','paidAmt','cancelled','settleExclude','clawback']){
    assert.equal(field in patch,false,field);
  }
});

test('정상 연결의 동일 해지 재시도는 추가 쓰기를 만들지 않는다',async()=>{
  const {repository,writes}=fixture({
    contractTerminatedAt:now,contractTerminationDate:input.effectiveDate,
    contractTerminationReason:input.reason,contractTerminationOperationId:input.operationId,
  });
  const result=await repository.terminateContract(contractId,input,'admin_test');
  assert.equal(result.terminated,false);
  assert.equal(result.effectiveDate,input.effectiveDate);
  assert.equal(writes.length,0);
});

test('역방향 링크가 없는 레거시는 기존 link helper 정책을 유지한다',async()=>{
  const {repository,writes}=fixture({esignContractId:''});
  const result=await repository.terminateContract(contractId,input,'admin_test');
  assert.equal(result.terminated,true);
  assert.equal(writes.length,4);
});

test('실제 어댑터도 인도일 오류를 받으면 한 건도 쓰지 않는다',async()=>{
  const {repository,writes}=fixture({deliveredAt:'2026-02-30'});
  await assert.rejects(repository.terminateContract(contractId,input,'admin_test'),/인도일.*인도 기록/);
  assert.equal(writes.length,0);
});
