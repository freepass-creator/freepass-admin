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

test('인도 전에는 계약금 수납 여부에 따라 접수취소 또는 계약취소다', () => {
  const result=planContractTermination(contract(),intake({delivered:false,deliveredAt:''}),input,Date.parse('2026-09-25T06:00:00Z'));
  assert.equal(result.ok,false);
  assert.match(String((result as {error?:string}).error),/접수취소.*계약취소/);
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

test('동일 operationId와 동일 payload 재시도는 계약·접수 mirror가 모두 같을 때만 idempotent다', () => {
  const rawContract=contract({
    contract_status:'계약해지',
    contract_terminated_at:100,
    contract_termination_date:'2026-09-25',
    contract_termination_reason:'고객 중도해지',
    contract_termination_operation_id:'terminate_1234567890abcdef',
  });
  const rawIntake=intake({
    contractTerminatedAt:100,
    contractTerminationDate:'2026-09-25',
    contractTerminationReason:'고객 중도해지',
    contractTerminationOperationId:'terminate_1234567890abcdef',
  });
  const same=planContractTermination(rawContract,rawIntake,input,Date.parse('2026-09-25T06:00:00Z'));
  assert.deepEqual(same,{ok:true,idempotent:true,patch:{},intakePatch:{}});

  const changed=planContractTermination(rawContract,rawIntake,{...input,reason:'다른 사유'},Date.parse('2026-09-25T06:00:00Z'));
  assert.equal(changed.ok,false);
  assert.match(String((changed as {error?:string}).error),/이미 계약해지/);
});

test('계약 또는 접수 한쪽에만 해지 기록이 남은 partial state는 덮어쓰지 않는다', () => {
  const intakeOnly=planContractTermination(
    contract(),
    intake({
      contractTerminatedAt:100,
      contractTerminationDate:'2026-09-25',
      contractTerminationReason:'고객 중도해지',
      contractTerminationOperationId:'terminate_1234567890abcdef',
    }),
    input,
    Date.parse('2026-09-25T06:00:00Z'),
  );
  assert.equal(intakeOnly.ok,false);
  assert.match(String((intakeOnly as {error?:string}).error),/계약과 접수.*일치하지/);

  const contractOnly=planContractTermination(
    contract({
      contract_status:'계약해지',
      contract_terminated_at:100,
      contract_termination_date:'2026-09-25',
      contract_termination_reason:'고객 중도해지',
      contract_termination_operation_id:'terminate_1234567890abcdef',
    }),
    intake(),
    input,
    Date.parse('2026-09-25T06:00:00Z'),
  );
  assert.equal(contractOnly.ok,false);
  assert.match(String((contractOnly as {error?:string}).error),/계약과 접수.*일치하지/);
});

test('양쪽 모두 해지처럼 보여도 timestamp·operation·payload mirror가 다르면 fail closed', () => {
  const baseContract={
    contract_status:'계약해지',
    contract_terminated_at:100,
    contract_termination_date:'2026-09-25',
    contract_termination_reason:'고객 중도해지',
    contract_termination_operation_id:'terminate_1234567890abcdef',
  };
  const baseIntake={
    contractTerminatedAt:100,
    contractTerminationDate:'2026-09-25',
    contractTerminationReason:'고객 중도해지',
    contractTerminationOperationId:'terminate_1234567890abcdef',
  };
  for(const [name,contractPatch,intakePatch] of [
    ['timestamp',{}, {contractTerminatedAt:101}],
    ['operation',{}, {contractTerminationOperationId:'terminate_other_1234567890'}],
    ['date',{contract_termination_date:'2026-09-24'}, {}],
    ['reason',{}, {contractTerminationReason:'다른 사유'}],
  ] as const){
    const result=planContractTermination(
      contract({...baseContract,...contractPatch}),
      intake({...baseIntake,...intakePatch}),
      input,
      Date.parse('2026-09-25T06:00:00Z'),
    );
    assert.equal(result.ok,false,name);
    assert.match(String((result as {error?:string}).error),/계약과 접수.*일치하지/,name);
  }
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

const now=Date.parse('2026-09-25T06:00:00Z');

for(const day of [
  '2026-02-29','2026-02-30','2026-04-31','1900-02-29',
  '2026-00-10','2026-13-10','2026-01-00','2026-01-32',
  '0000-01-01','2026-9-10',
]){
  test(`존재하지 않거나 형식이 잘못된 해지일 거부: ${day}`,()=>{
    const result=planContractTermination(
      contract(),intake({deliveredAt:'1900-01-01'}),
      {...input,effectiveDate:day},now,
    );
    assert.equal(result.ok,false);
    if(result.ok)return;
    assert.match(result.error,/계약해지일.*유효한 날짜/);
  });
}

for(const day of ['2024-02-29','2000-02-29','2026-04-30','2026-09-25']){
  test(`윤년과 월말의 유효한 해지일 허용: ${day}`,()=>{
    const result=planContractTermination(
      contract(),intake({deliveredAt:day}),{...input,effectiveDate:day},now,
    );
    assert.equal(result.ok,true);
  });
}

for(const day of ['', '2026-02-30','2026-04-31','1900-02-29','2026-13-01','2026-9-10']){
  test(`인도 완료의 잘못된 인도일은 취소로 분류하지 않고 기록 정정 요구: ${day}`,()=>{
    const result=planContractTermination(contract(),intake({deliveredAt:day}),input,now);
    assert.equal(result.ok,false);
    if(result.ok)return;
    assert.match(result.error,/인도일.*인도 기록/);
    assert.doesNotMatch(result.error,/계약취소/);
  });
}

for(const clock of [NaN,Infinity,-Infinity,Number.MAX_VALUE]){
  test(`유효하지 않은 서버 시각은 예외 대신 실패 결과 반환: ${String(clock)}`,()=>{
    const result=planContractTermination(contract(),intake(),input,clock);
    assert.equal(result.ok,false);
    if(result.ok)return;
    assert.match(result.error,/처리 시각/);
  });
}

test('오늘 판정은 UTC가 아니라 한국 시간의 자정 경계를 따른다',()=>{
  const tomorrow={...input,effectiveDate:'2026-09-26'};
  const before=planContractTermination(contract(),intake(),tomorrow,Date.parse('2026-09-25T14:59:59.999Z'));
  const after=planContractTermination(contract(),intake(),tomorrow,Date.parse('2026-09-25T15:00:00.000Z'));
  assert.equal(before.ok,false);
  assert.equal(after.ok,true);
});

test('검증은 원본 계약과 접수의 청구·지급·계산서·현금 기록을 변경하지 않는다',()=>{
  const rawContract=Object.freeze(contract());
  const rawIntake=Object.freeze(intake({
    billed:true,claimStage:'확인',payStage:'통보',collectedAmt:200000,paidAmt:100000,
  }));
  const before=JSON.stringify({rawContract,rawIntake});
  const result=planContractTermination(rawContract,rawIntake,input,now);
  assert.equal(result.ok,true);
  assert.equal(JSON.stringify({rawContract,rawIntake}),before);
  if(!result.ok)return;
  for(const field of ['billed','claimStage','payStage','collectedAmt','paidAmt','cancelled','settleExclude','clawback']){
    assert.equal(field in result.intakePatch,false,field);
  }
});
