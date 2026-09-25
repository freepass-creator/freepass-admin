import test from 'node:test';
import assert from 'node:assert/strict';
import { planContractTermination } from './termination';

const contract = (o: Record<string, unknown> = {}) => ({
  contract_status:'계약완료',
  sign_status:'서명완료',
  esign_id:'esg_1',
  ...o,
});

const intake = (o: Record<string, unknown> = {}) => ({
  cancelled:false,
  delivered:true,
  deliveredAt:'2026-09-10',
  ...o,
});

const input = {
  effectiveDate:'2026-09-25',
  reason:'고객 중도해지',
  operationId:'terminate_1234567890abcdef',
};

test('인도된 계약은 계약해지 사실만 기록하고 정산 필드는 건드리지 않는다', () => {
  const result=planContractTermination(contract(),intake({
    billed:true,claimStage:'확인',payStage:'통보',collectedAmt:0,paidAmt:0,
  }),input,Date.parse('2026-09-25T06:00:00Z'));
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(result.idempotent,false);
  assert.equal(result.patch.contract_status,'계약해지');
  assert.equal(result.intakePatch.contractTerminationDate,'2026-09-25');
  assert.equal('cancelled' in result.intakePatch,false);
  assert.equal('settleExclude' in result.intakePatch,false);
  assert.equal('clawback' in result.intakePatch,false);
});

test('인도 전 계약은 계약해지가 아니라 계약취소다', () => {
  const result=planContractTermination(contract(),intake({delivered:false,deliveredAt:''}),input,Date.parse('2026-09-25T06:00:00Z'));
  assert.equal(result.ok,false);
  assert.match(String((result as {error?:string}).error),/계약취소/);
});

test('계약해지일은 인도일보다 빠르거나 오늘보다 미래일 수 없다', () => {
  const before=planContractTermination(contract(),intake(),{...input,effectiveDate:'2026-09-01'},Date.parse('2026-09-25T06:00:00Z'));
  assert.equal(before.ok,false);
  assert.match(String((before as {error?:string}).error),/인도일/);

  const future=planContractTermination(contract(),intake(),{...input,effectiveDate:'2026-09-26'},Date.parse('2026-09-25T06:00:00Z'));
  assert.equal(future.ok,false);
  assert.match(String((future as {error?:string}).error),/오늘/);
});

test('이미 계약취소된 건은 계약해지로 바꾸지 않는다', () => {
  const result=planContractTermination(
    contract({contract_status:'계약취소'}),
    intake({cancelled:true,contractCancelledAt:1}),
    input,
    Date.parse('2026-09-25T06:00:00Z'),
  );
  assert.equal(result.ok,false);
  assert.match(String((result as {error?:string}).error),/계약취소된/);
});

test('전자계약이 연결됐는데 서명완료가 아니면 데이터 불일치로 막는다', () => {
  const result=planContractTermination(contract({sign_status:'열람'}),intake(),input,Date.parse('2026-09-25T06:00:00Z'));
  assert.equal(result.ok,false);
  assert.match(String((result as {error?:string}).error),/서명 상태/);
});

test('동일 operationId와 동일 payload 재시도만 idempotent다', () => {
  const raw=intake({
    contractTerminatedAt:100,
    contractTerminationDate:'2026-09-25',
    contractTerminationReason:'고객 중도해지',
    contractTerminationOperationId:'terminate_1234567890abcdef',
  });
  const same=planContractTermination(contract({contract_status:'계약해지'}),raw,input,Date.parse('2026-09-25T06:00:00Z'));
  assert.deepEqual(same,{ok:true,idempotent:true,patch:{},intakePatch:{}});

  const changed=planContractTermination(contract({contract_status:'계약해지'}),raw,{...input,reason:'다른 사유'},Date.parse('2026-09-25T06:00:00Z'));
  assert.equal(changed.ok,false);
  assert.match(String((changed as {error?:string}).error),/이미 계약해지/);
});


test('legacy cancelled 참 cannot be converted into termination', () => {
  const result=planContractTermination(
    contract(),
    intake({cancelled:'참'}),
    input,
    Date.parse('2026-09-25T06:00:00Z'),
  );
  assert.equal(result.ok,false);
  assert.match(String((result as {error?:string}).error),/계약취소된/);
});
