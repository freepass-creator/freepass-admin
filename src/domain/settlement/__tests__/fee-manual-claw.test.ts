import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feeManualErrors, intakeRecord, type IntakeInput } from '../intake.js';
import { feeFixPatch } from '../adjust.js';
import { clawbackId, clawbackRecord, pendingTerminationClawbackRows, planTerminationClawbackReview, terminationClawbackFollowUp, terminationClawbackReview } from '../clawback.js';
import { toSettlementRow } from '../../../adapters/erp5/to-settlement.js';

const base: IntakeInput = {
  receivedAt: '2026-09-18', plate: 'PLATEA', model: 'G80', supplier: '예시공급사A', supplierCode: '', customer: '고객 A',
  channel: '하허호', channelCode: '', agent: '김', agentCode: '', product: '신차발주', rentKind: '', contractType: '',
  term: 60, rent: 900_000, deposit: 0, price: 60_000_000, payKind: '일시납', paper: false, delivered: false, deliveredAt: '', note: '',
};
const CLAW_NOW = Date.parse('2026-09-30T12:00:00+09:00');
const REVIEW_NOW = Date.parse('2026-09-26T12:00:00+09:00');



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
  const row = (o: Record<string, unknown>) => toSettlementRow({ code: 'stl_x', plate: 'PLATE-EXAMPLE', receivedAt: '2026-06-01', delivered: true, deliveredAt: '2026-06-05', supplier: '예시공급사B', channel: '하허호', model: 'EV6', ...o }, 'stl_x').row;
  it('신규 환수 id는 계약줄까지 포함해 같은 차·같은 달 재계약 충돌을 막는다', () => {
    const r = clawbackRecord(row({ collected: true, paid: true, claimStage: '수금', payStage: '지급' }), { at: '2026-09-10', supplierAmt: 1_000_000, agentAmt: 800_000, reason: '3개월 내 해지' }, 't', CLAW_NOW);
    assert.ok(r.ok);
    assert.equal(r.ok && r.id, clawbackId('PLATE-EXAMPLE', '2026-09', 'stl_x'));
    assert.notEqual(clawbackId('PLATE-EXAMPLE', '2026-09', 'stl_x'), clawbackId('PLATE-EXAMPLE', '2026-09', 'stl_y'));
    assert.equal(r.ok && r.doc.month, '2026-09');
    assert.equal(r.ok && r.doc.code, 'stl_x');
  });
  it('사유 · 금액 · 인도 · 실제 수금/지급 완료가 필수', () => {
    assert.equal(clawbackRecord(row({ collected: true, claimStage: '수금' }), { at: '2026-09-10', supplierAmt: 1, agentAmt: 0, reason: '' }, 't', CLAW_NOW).ok, false);
    assert.equal(clawbackRecord(row({ collected: true, claimStage: '수금' }), { at: '2026-09-10', supplierAmt: 0, agentAmt: 0, reason: 'x' }, 't', CLAW_NOW).ok, false);
    assert.equal(clawbackRecord(row({ delivered: false, deliveredAt: '', collected: true, claimStage: '수금' }), { at: '2026-09-10', supplierAmt: 1, agentAmt: 0, reason: 'x' }, 't', CLAW_NOW).ok, false);
    assert.equal(clawbackRecord(row({}), { at: '2026-09-10', supplierAmt: 1, agentAmt: 0, reason: 'x' }, 't', CLAW_NOW).ok, false);
    assert.equal(clawbackRecord(row({ collected: true, claimStage: '수금' }), { at: '2026-09-10', supplierAmt: 0, agentAmt: 1, reason: 'x' }, 't', CLAW_NOW).ok, false);
  });
  it('환수일은 실제 날짜이며 미래·인도 전·해지 전일 수 없다', () => {
    const settled = row({ collected: true, paid: true, claimStage: '수금', payStage: '지급' });
    assert.equal(clawbackRecord(settled, { at: '2026-02-30', supplierAmt: 1, agentAmt: 0, reason: 'x' }, 't', CLAW_NOW).ok, false);
    assert.equal(clawbackRecord(settled, { at: '2026-10-01', supplierAmt: 1, agentAmt: 0, reason: 'x' }, 't', CLAW_NOW).ok, false);
    assert.equal(clawbackRecord(settled, { at: '2026-06-04', supplierAmt: 1, agentAmt: 0, reason: 'x' }, 't', CLAW_NOW).ok, false);

    const terminated = {
      ...settled,
      contractTerminatedAt: Date.parse('2026-09-25T00:00:00+09:00'),
      contractTerminationDate: '2026-09-25',
    };
    assert.equal(clawbackRecord(terminated, { at: '2026-09-24', supplierAmt: 1, agentAmt: 0, reason: '해지 환수' }, 't', CLAW_NOW).ok, false);
    assert.equal(clawbackRecord(terminated, { at: '2026-09-25', supplierAmt: 1, agentAmt: 0, reason: '해지 환수' }, 't', CLAW_NOW).ok, true);
  });
});





it('계약해지 후 사람이 환수를 세우면 해지 provenance를 함께 보존한다', () => {
  const row = (o: Record<string, unknown>) => toSettlementRow({ code: 'stl_x', plate: 'PLATE-EXAMPLE', receivedAt: '2026-06-01', delivered: true, deliveredAt: '2026-06-05', supplier: '예시공급사B', channel: '하허호', model: 'EV6', ...o }, 'stl_x').row;
  const terminated = {
    ...row({ collected:true, paid:true, claimStage:'수금', payStage:'지급' }),
    contractTerminationContractId:'ctr_term_1',
    contractTerminatedAt:Date.parse('2026-09-25T00:00:00Z'),
    contractTerminationDate:'2026-09-25',
    contractTerminationReason:'중도해지',
  };
  const result=clawbackRecord(terminated,{
    at:'2026-09-25',supplierAmt:100000,agentAmt:80000,reason:'해지 환수',
  },'tester',Date.now());
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(result.doc.source,'CONTRACT_TERMINATION');
  assert.equal(result.doc.contractId,'ctr_term_1');
  assert.equal(result.doc.contractTerminationDate,'2026-09-25');
  assert.equal(result.doc.contractTerminationReason,'중도해지');
});


describe('계약해지 → 환수 검토대상', () => {
  const baseRow = {
    id: 'stl_term_target',
    contractTerminatedAt: Date.parse('2026-09-25T00:00:00Z'),
  };

  it('계약해지가 찍히면 환수를 자동 생성하지 않고 검토대상으로 분류한다', () => {
    assert.equal(terminationClawbackReview(baseRow as never, []), 'PENDING');
  });

  it('같은 접수 code의 환수가 실제 등록되면 검토 완료로 본다', () => {
    assert.equal(
      terminationClawbackReview(baseRow as never, [{ code: 'stl_term_target' }]),
      'RECORDED',
    );
  });

  it('다른 재계약 건의 환수나 code 없는 레거시 환수는 이 해지의 완료로 추측하지 않는다', () => {
    assert.equal(
      terminationClawbackReview(baseRow as never, [{ code: 'stl_other' }, {}]),
      'PENDING',
    );
  });

  it('계약해지가 아니면 환수 검토대상이 아니다', () => {
    assert.equal(
      terminationClawbackReview({ id: 'stl_normal', contractTerminatedAt: null } as never, []),
      'NONE',
    );
  });

  it('환수 검토 큐는 미검토와 환수 필요 확정 건만 최신 해지일부터 세운다', () => {
    const rows = [
      { id: 'old', contractTerminatedAt: 1, contractTerminationDate: '2026-09-20' },
      { id: 'new', contractTerminatedAt: 2, contractTerminationDate: '2026-09-25' },
      { id: 'required', contractTerminatedAt: 3, contractTerminationDate: '2026-09-24',
        contractClawbackReviewDecision: 'REQUIRED', contractClawbackReviewedAt: 100,
        contractClawbackReviewReason: '공급사 유지조건 검토', contractClawbackReviewOperationId: 'clawreview_required_1234' },
      { id: 'none', contractTerminatedAt: 4, contractTerminationDate: '2026-09-23',
        contractClawbackReviewDecision: 'NOT_REQUIRED', contractClawbackReviewedAt: 101,
        contractClawbackReviewReason: '유지기간 충족', contractClawbackReviewOperationId: 'clawreview_none_123456' },
      { id: 'done', contractTerminatedAt: 5, contractTerminationDate: '2026-09-22' },
      { id: 'live', contractTerminatedAt: null, contractTerminationDate: null },
    ];
    const pending = pendingTerminationClawbackRows(rows as never, [{ code: 'done' }]);
    assert.deepEqual(pending.map((r) => r.id), ['new', 'required', 'old']);
  });

  it('환수 없음 확정은 PENDING을 종료하고 같은 operation 재시도는 idempotent다', () => {
    const row = { id: 'stl_none', contractTerminatedAt: 1, contractTerminationDate: '2026-09-25' };
    const input = { decision: 'NOT_REQUIRED' as const, reason: '유지기간 충족', operationId: 'clawreview_none_123456' };
    const planned = planTerminationClawbackReview(row, [], input, 100);
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(planned.idempotent, false);
    assert.equal(planned.patch.contractClawbackReviewDecision, 'NOT_REQUIRED');

    const stored = { ...row, ...planned.patch };
    assert.equal(terminationClawbackReview(stored as never, []), 'NOT_REQUIRED');
    assert.deepEqual(
      planTerminationClawbackReview(stored as never, [], input, 200),
      { ok: true, idempotent: true, patch: {} },
    );
  });

  it('환수 필요 확정은 실제 환수 등록 전 REQUIRED, 등록 뒤 RECORDED다', () => {
    const row = { id: 'stl_required', contractTerminatedAt: 1, contractTerminationDate: '2026-09-25' };
    const input = { decision: 'REQUIRED' as const, reason: '3개월 유지조건 미충족', operationId: 'clawreview_need_123456' };
    const planned = planTerminationClawbackReview(row, [], input, 100);
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    const stored = { ...row, ...planned.patch };
    assert.equal(terminationClawbackReview(stored as never, []), 'REQUIRED');
    assert.equal(terminationClawbackReview(stored as never, [{ code: 'stl_required' }]), 'RECORDED');
  });

  it('해지 아닌 건·사유 없는 검토·잘못된 operation은 환수 검토 확정할 수 없다', () => {
    assert.equal(planTerminationClawbackReview(
      { id: 'live', contractTerminatedAt: null, contractTerminationDate: null }, [],
      { decision: 'NOT_REQUIRED', reason: '없음', operationId: 'clawreview_live_12345' }, 100,
    ).ok, false);
    assert.equal(planTerminationClawbackReview(
      baseRow as never, [],
      { decision: 'NOT_REQUIRED', reason: '', operationId: 'clawreview_none_123456' }, 100,
    ).ok, false);
    assert.equal(planTerminationClawbackReview(
      baseRow as never, [],
      { decision: 'NOT_REQUIRED', reason: '유지기간 충족', operationId: 'bad' }, 100,
    ).ok, false);
  });

  it('환수 없음 확정과 실제 환수가 동시에 있으면 모순으로 fail closed', () => {
    const row = {
      ...baseRow,
      contractClawbackReviewDecision: 'NOT_REQUIRED',
      contractClawbackReviewedAt: REVIEW_NOW,
      contractClawbackReviewReason: '환수 없음',
      contractClawbackReviewOperationId: 'clawreview_none_123456',
    };
    assert.equal(terminationClawbackReview(row as never, [{ code: 'stl_term_target' }]), 'INCONSISTENT');
    const replanned = planTerminationClawbackReview(
      row as never, [{ code: 'stl_term_target' }],
      { decision: 'REQUIRED', reason: '뒤늦은 변경', operationId: 'clawreview_change_1234' }, REVIEW_NOW + 1,
    );
    assert.equal(replanned.ok, false);
  });

  it('부분 저장된 환수 검토 기록은 자동 보정하지 않고 INCONSISTENT로 본다', () => {
    const dirty = { ...baseRow, contractClawbackReviewDecision: 'REQUIRED' };
    assert.equal(terminationClawbackReview(dirty as never, []), 'INCONSISTENT');
    assert.equal(planTerminationClawbackReview(
      dirty as never, [],
      { decision: 'REQUIRED', reason: '환수 필요', operationId: 'clawreview_dirty_12345' }, 200,
    ).ok, false);
  });
  it('환수 검토는 해지 이후 시각에만 확정하고 허용된 decision만 받는다', () => {
    const before = Number(baseRow.contractTerminatedAt) - 1;
    assert.equal(planTerminationClawbackReview(
      baseRow as never, [],
      { decision: 'NOT_REQUIRED', reason: '유지기간 충족', operationId: 'clawreview_before_1234' }, before,
    ).ok, false);

    assert.equal(planTerminationClawbackReview(
      baseRow as never, [],
      { decision: 'UNKNOWN' as never, reason: '잘못된 값', operationId: 'clawreview_unknown_123' }, REVIEW_NOW,
    ).ok, false);
  });

  it('기존 검토시각이 해지시각보다 빠르면 INCONSISTENT로 본다', () => {
    const dirty = {
      ...baseRow,
      contractClawbackReviewDecision: 'REQUIRED',
      contractClawbackReviewedAt: Number(baseRow.contractTerminatedAt) - 1,
      contractClawbackReviewReason: '환수 필요',
      contractClawbackReviewOperationId: 'clawreview_oldtime_123',
    };
    assert.equal(terminationClawbackReview(dirty as never, []), 'INCONSISTENT');
  });

  it('환수 후속업무는 정산 blocker와 별도로 검토/등록/데이터확인을 가리킨다', () => {
    assert.equal(terminationClawbackFollowUp(baseRow as never, []), 'REVIEW');

    const required = {
      ...baseRow,
      contractClawbackReviewDecision: 'REQUIRED',
      contractClawbackReviewedAt: REVIEW_NOW,
      contractClawbackReviewReason: '환수 필요',
      contractClawbackReviewOperationId: 'clawreview_required_1234',
    };
    assert.equal(terminationClawbackFollowUp(required as never, []), 'RECORD_CLAWBACK');
    assert.equal(terminationClawbackFollowUp(required as never, [{ code: 'stl_term_target' }]), 'NONE');

    const noClawback = {
      ...baseRow,
      contractClawbackReviewDecision: 'NOT_REQUIRED',
      contractClawbackReviewedAt: REVIEW_NOW,
      contractClawbackReviewReason: '유지기간 충족',
      contractClawbackReviewOperationId: 'clawreview_none_123456',
    };
    assert.equal(terminationClawbackFollowUp(noClawback as never, []), 'NONE');
    assert.equal(terminationClawbackFollowUp(
      { ...baseRow, contractClawbackReviewDecision: 'REQUIRED' } as never, [],
    ), 'DATA_CHECK');
  });
});

it('수수료 직접수정과 환수는 소수 원 금액을 받지 않는다', () => {
  assert.equal(feeFixPatch({ claimWritten: 100 }, 100.4, null, '소수 입력').ok, false);
  const settled = toSettlementRow({
    code: 'stl_fraction', plate: 'PLATEA', receivedAt: '2026-06-01',
    delivered: true, deliveredAt: '2026-06-05', supplier: 'A', channel: 'B',
    collected: true, paid: true, claimStage: '수금', payStage: '지급',
  }, 'stl_fraction').row;
  assert.equal(clawbackRecord(
    settled,
    { at: '2026-09-10', supplierAmt: 0.4, agentAmt: 0, reason: '소수 입력' },
    'tester',
    CLAW_NOW,
  ).ok, false);
});
