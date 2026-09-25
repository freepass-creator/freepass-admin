import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feeCompletenessErrors, feeManualErrors, intakeRecord, type IntakeInput } from '../intake.js';
import { feeFixPatch } from '../adjust.js';
import { clawbackId, clawbackRecord, sameClawbackPayload } from '../clawback.js';
import { cancellationClawbackCompletionPatch, cancellationClawbackRequirement, cancellationClawbackStateOf, validateCancellationClawbackInput } from '../cancellation-clawback.js';
import type { FeeResult } from '../fee.js';
import { toSettlementRow } from '../../../adapters/erp5/to-settlement.js';

const base: IntakeInput = {
  receivedAt: '2026-09-18', plate: '12가3456', model: 'G80', supplier: '손오공', supplierCode: '', customer: '홍길동',
  channel: '하허호', channelCode: '', agent: '김', agentCode: '', product: '신차발주', rentKind: '', contractType: '',
  term: 60, rent: 900_000, deposit: 0, price: 60_000_000, payKind: '일시납', paper: false, delivered: false, deliveredAt: '', note: '',
};
const manualRule: FeeResult = { status: 'MANUAL', rule: { id: 'm', supplier: '손오공', kind: '신차', form: '발주', term: 0, basis: '범위', claim: '건별 책정', pay: '건별 책정', when: '', auto: false }, why: '표가 「건별 책정」 — 사람이 정한다' };
const autoRule: FeeResult = { status: 'AUTO', rule: { id: 'a', supplier: '손오공', kind: '재렌트', form: '', term: 48, basis: '대여료×기간', claim: 0.0325, pay: 0.025, when: '', auto: true }, claim: 1_092_000, pay: 840_000 };
const noBaseRule: FeeResult = { status: 'NO_BASE', rule: { id: 'n', supplier: '손오공', kind: '신차', form: '선출고', term: 0, basis: '차량가액', claim: 0.035, pay: 0.03, when: '', auto: true }, why: '차량가액이 없다' };
const noRule: FeeResult = { status: 'NO_RULE', why: '표에 「새공급사 · 재렌트 48개월」 가 없다' };

const row = (o: Record<string, unknown> = {}) => toSettlementRow({
  code: 'stl_x', plate: '12가 3456', receivedAt: '2026-06-01',
  delivered: true, deliveredAt: '2026-06-05',
  supplier: '오토플러스', channel: '하허호', model: 'EV6', ...o,
}, 'stl_x').row;

describe('수수료 직접 입력 — 대표 「직접접수하는 방식」', () => {
  it('★신차발주(주는 대로)는 사유 없이 넣어도 된다 · 넣은 값이 선다', () => {
    const x = { ...base, feeManual: { claim: 5_100_000, pay: 4_200_000, reason: '' } };
    assert.deepEqual(feeManualErrors(x, manualRule), []);
    const r = intakeRecord(x, 0, manualRule, 'v');
    assert.deepEqual([r.claimWritten, r.payWritten, r.supplierRate, r.agentRate], [5_100_000, 4_200_000, 0, 0]);
    assert.match(String(r.settleNote), /직접 입력/);
  });
  it('표가 낸 값과 다르게 넣으면 사유가 있어야 한다', () => {
    assert.equal(feeManualErrors({ ...base, feeManual: { claim: 1_000_000, pay: null, reason: '' } }, autoRule).length, 1);
    assert.equal(feeManualErrors({ ...base, feeManual: { claim: 1_000_000, pay: null, reason: '공급사 협의' } }, autoRule).length, 0);
  });
  it('한쪽만 넣으면 다른 쪽은 표대로 · 표 요율은 표가 낸 쪽만', () => {
    const r = intakeRecord({ ...base, feeManual: { claim: 1_000_000, pay: null, reason: '협의' } }, 0, autoRule, 'v');
    assert.deepEqual([r.claimWritten, r.payWritten, r.supplierRate, r.agentRate], [1_000_000, 840_000, 0, 0.025]);
  });
});

describe('자동 기준값 또는 직접 수수료 중 하나는 반드시 완성한다', () => {
  it('AUTO면 직접 수수료 없이도 통과한다', () => {
    assert.deepEqual(feeCompletenessErrors(base, autoRule), []);
  });
  it('차량가액 기준인데 값이 없으면 기준값 또는 직접 입력을 요구한다', () => {
    assert.match(feeCompletenessErrors({ ...base, price: null }, noBaseRule).join(), /차량가액/);
    assert.deepEqual(feeCompletenessErrors({
      ...base, price: null, feeManual: { claim: 1_000_000, pay: 800_000, reason: '' },
    }, noBaseRule), []);
  });
  it('자동 규칙이 없거나 사람이 정하는 규칙이면 청구·지급을 둘 다 직접 넣는다', () => {
    assert.equal(feeCompletenessErrors(base, manualRule).length, 1);
    assert.equal(feeCompletenessErrors({ ...base, feeManual: { claim: 1_000_000, pay: null, reason: '' } }, manualRule).length, 1);
    assert.deepEqual(feeCompletenessErrors({
      ...base, feeManual: { claim: 1_000_000, pay: 800_000, reason: '' },
    }, manualRule), []);
    assert.equal(feeCompletenessErrors(base, noRule).length, 1);
  });
});

describe('접수 뒤 수수료 고치기', () => {
  it('사유 필수 · 청구서 나간 줄의 청구는 못 바꾼다', () => {
    assert.equal(feeFixPatch({ claimWritten: 0 }, 100, null, '').ok, false);
    assert.equal(feeFixPatch({ claimWritten: 0, billed: true }, 100, null, '금액 확정').ok, false);
    const r = feeFixPatch({ claimWritten: 0, payWritten: 0, settleNote: '수수료: 표에 없다' }, 1_500_000, 1_200_000, '금탑 요율 확정');
    assert.ok(r.ok);
    assert.equal(r.ok && r.patch.claimWritten, 1_500_000);
    assert.equal(r.ok && r.patch.settleNote, '수수료: 표에 없다 / [수수료 고침] 금탑 요율 확정');
  });
});

describe('수수료 고침 — 레거시 완료표시도 잠근다', () => {
  it('Y/1/참 상태에서 발행된 축 금액을 다시 쓰지 않는다', () => {
    assert.equal(feeFixPatch({ billed: 'Y', claimWritten: 100 }, 200, null, '정정').ok, false);
    assert.equal(feeFixPatch({ paid: 1, payWritten: 100 }, null, 200, '정정').ok, false);
    assert.equal(feeFixPatch({ cancelled: '참', claimWritten: 100 }, 200, null, '정정').ok, false);
  });
});

describe('환수 — 열어 둔다', () => {
  it('신규 환수 id는 계약줄까지 포함해 같은 차·같은 달 재계약 충돌을 막는다', () => {
    const r = clawbackRecord(row({ collected: true, paid: true, claimStage: '수금', payStage: '지급' }), { at: '2026-09-10', supplierAmt: 1_000_000, agentAmt: 800_000, reason: '3개월 내 해지' }, 't', 0);
    assert.ok(r.ok);
    assert.equal(r.ok && r.id, clawbackId('12가 3456', '2026-09', 'stl_x'));
    assert.notEqual(clawbackId('12가 3456', '2026-09', 'stl_x'), clawbackId('12가 3456', '2026-09', 'stl_y'));
    assert.equal(r.ok && r.doc.month, '2026-09');
    assert.equal(r.ok && r.doc.code, 'stl_x');
  });
  it('사유 · 금액 · 인도 · 실제 수금/지급 완료가 필수', () => {
    assert.equal(clawbackRecord(row({ collected: true, claimStage: '수금' }), { at: '2026-09-10', supplierAmt: 1, agentAmt: 0, reason: '' }, 't', 0).ok, false);
    assert.equal(clawbackRecord(row({ collected: true, claimStage: '수금' }), { at: '2026-09-10', supplierAmt: 0, agentAmt: 0, reason: 'x' }, 't', 0).ok, false);
    assert.equal(clawbackRecord(row({ delivered: false, deliveredAt: '', collected: true, claimStage: '수금' }), { at: '2026-09-10', supplierAmt: 1, agentAmt: 0, reason: 'x' }, 't', 0).ok, false);
    assert.equal(clawbackRecord(row({}), { at: '2026-09-10', supplierAmt: 1, agentAmt: 0, reason: 'x' }, 't', 0).ok, false);
    assert.equal(clawbackRecord(row({ collected: true, claimStage: '수금' }), { at: '2026-09-10', supplierAmt: 0, agentAmt: 1, reason: 'x' }, 't', 0).ok, false);
  });
});


test('계약 취소 후 환수는 취소된 전자계약 provenance를 함께 보존한다', () => {
  const r = {
    ...row(),
    esignContractId: 'ctr_cancelled_1',
    contractCancelledAt: Date.parse('2026-09-24T00:00:00+09:00'),
    contractCancellationReason: '중도해지',
    contractCancellationNeedsClawback: true,
    progress: { ...row().progress, delivered: true, collected: true, paid: true },
    claimStage: '수금' as const,
    payStage: '지급' as const,
  };
  const result = clawbackRecord(r, {
    at: '2026-09-25',
    supplierAmt: 100000,
    agentAmt: 80000,
    reason: '계약 취소 환수',
  }, 'tester', Date.now());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.doc.source, 'CONTRACT_CANCELLATION');
  assert.equal(result.doc.contractId, 'ctr_cancelled_1');
  assert.equal(result.doc.contractCancellationReason, '중도해지');
});


test('동일 환수 재시도 판정은 금액·일자·사유·계약줄이 같아야 한다', () => {
  const baseDoc = {
    code: 'stl_x',
    at: '2026-09-25',
    supplierAmt: 100000,
    agentAmt: 80000,
    reason: '계약 취소 환수',
  };
  assert.equal(sameClawbackPayload(baseDoc, { ...baseDoc }), true);
  assert.equal(sameClawbackPayload(baseDoc, { ...baseDoc, agentAmt: 70000 }), false);
  assert.equal(sameClawbackPayload(baseDoc, { ...baseDoc, reason: '다른 사유' }), false);
  assert.equal(sameClawbackPayload(baseDoc, { ...baseDoc, code: 'stl_y' }), false);
});


describe('계약취소 환수 후속 — 공급사/영업축 분리', () => {
  it('실제 돈이 움직인 축만 REQUIRED로 잡는다', () => {
    assert.deepEqual(cancellationClawbackRequirement({
      collected:true,collectedAmt:100000,claimStage:'수금',
      paid:false,paidAmt:0,payStage:'확인',
    }), { supplier:'REQUIRED',channel:'NONE',needsClawback:true });

    assert.deepEqual(cancellationClawbackRequirement({
      collected:false,collectedAmt:0,claimStage:'확인',
      paid:true,paidAmt:80000,payStage:'지급',
    }), { supplier:'NONE',channel:'REQUIRED',needsClawback:true });
  });

  it('두 축이 모두 필요하면 한 번의 환수 증거에 두 금액을 모두 요구한다', () => {
    const r = {
      ...row(),
      contractCancelledAt: Date.now(),
      contractCancellationSupplierClawbackState:'REQUIRED' as const,
      contractCancellationChannelClawbackState:'REQUIRED' as const,
      progress:{...row().progress,collected:true,paid:true,delivered:true},
      claimStage:'수금' as const,payStage:'지급' as const,
    };
    assert.match(String(validateCancellationClawbackInput(r,{
      at:'2026-09-25',supplierAmt:100000,agentAmt:0,reason:'취소 환수',
    })),/영업채널 환수액/);
    assert.equal(validateCancellationClawbackInput(r,{
      at:'2026-09-25',supplierAmt:100000,agentAmt:80000,reason:'취소 환수',
    }),null);
  });

  it('필요 없는 축에 환수액을 임의로 넣지 못한다', () => {
    const r = {
      ...row(),
      contractCancelledAt: Date.now(),
      contractCancellationSupplierClawbackState:'REQUIRED' as const,
      contractCancellationChannelClawbackState:'NONE' as const,
      progress:{...row().progress,collected:true,paid:false,delivered:true},
      claimStage:'수금' as const,payStage:'확인' as const,
    };
    assert.match(String(validateCancellationClawbackInput(r,{
      at:'2026-09-25',supplierAmt:100000,agentAmt:1,reason:'취소 환수',
    })),/영업채널 환수가 필요하지 않은/);
  });

  it('환수 생성 후 필요한 축만 COMPLETED로 종결하고 전체 pending을 내린다', () => {
    const supplierOnly = {
      ...row(),
      contractCancelledAt: Date.now(),
      contractCancellationSupplierClawbackState:'REQUIRED' as const,
      contractCancellationChannelClawbackState:'NONE' as const,
      progress:{...row().progress,collected:true,paid:false,delivered:true},
      claimStage:'수금' as const,payStage:'확인' as const,
    };
    assert.deepEqual(
      cancellationClawbackCompletionPatch(supplierOnly,{
        at:'2026-09-25',supplierAmt:100000,agentAmt:0,reason:'취소 환수',
      }),
      {
        contractCancellationSupplierClawbackState:'COMPLETED',
        contractCancellationChannelClawbackState:'NONE',
        contractCancellationNeedsClawback:false,
      },
    );
    assert.deepEqual(cancellationClawbackStateOf(supplierOnly),{supplier:'REQUIRED',channel:'NONE'});
  });
});
