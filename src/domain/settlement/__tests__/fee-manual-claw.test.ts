import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feeCompletenessErrors, feeManualErrors, intakeRecord, type IntakeInput } from '../intake.js';
import { feeFixPatch } from '../adjust.js';
import { clawbackId, clawbackRecord } from '../clawback.js';
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
  const row = (o: Record<string, unknown>) => toSettlementRow({ code: 'stl_x', plate: '12가 3456', receivedAt: '2026-06-01', delivered: true, deliveredAt: '2026-06-05', supplier: '오토플러스', channel: '하허호', model: 'EV6', ...o }, 'stl_x').row;
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
