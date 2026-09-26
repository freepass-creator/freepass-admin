import test from 'node:test';
import assert from 'node:assert/strict';
import { toSettlementRow } from '../../../adapters/erp5/to-settlement.js';
import { workflowConsistencyIssues, workflowMutationBlockedReason } from '../consistency.js';
import { lifePatch } from '../lifecycle.js';
import { clawbackRecord } from '../clawback.js';

const row = (o: Record<string, unknown> = {}) => toSettlementRow({
  code: String(o.code ?? 'stl_consistency'),
  plate: '12가3456',
  receivedAt: '2026-09-01',
  supplier: '공급사A',
  channel: '채널A',
  paper: true,
  delivered: true,
  deliveredAt: '2026-09-10',
  claimWritten: 100000,
  payWritten: 80000,
  payKind: '일시납',
  claimStage: '접수',
  payStage: '접수',
  ...o,
}, String(o.code ?? 'stl_consistency')).row;

test('정상적인 접수/실적/정산 상태는 consistency issue가 없다', () => {
  assert.deepEqual(workflowConsistencyIssues(row()), []);
  assert.deepEqual(workflowConsistencyIssues(row({
    billed: true, billedAt: '2026-09-15', invoiceIssued: true, invoiceAt: '2026-09-16',
    claimStage: '확인', payStage: '통보',
  })), []);
  assert.deepEqual(workflowConsistencyIssues(row({
    billed: true, invoiceIssued: true, collected: true, collectedAmt: 110000, claimStage: '수금',
    paid: true, paidAmt: 80000, payStage: '지급',
  })), []);
});

test('취소/해지/인도 사실이 서로 모순되면 명확한 issue를 낸다', () => {
  const cancelledDelivered = workflowConsistencyIssues(row({ cancelled: true }));
  assert.ok(cancelledDelivered.some((x) => x.code === 'CANCELLED_AND_DELIVERED'));

  const both = workflowConsistencyIssues(row({
    cancelled: true,
    settleExclude: true,
    contractCancelledAt: 100,
    contractTerminatedAt: 200,
  }));
  assert.ok(both.some((x) => x.code === 'CANCELLED_AND_TERMINATED'));
  assert.ok(both.some((x) => x.code === 'TERMINATED_AND_CANCELLED'));

  const terminationBeforeDelivery = workflowConsistencyIssues(row({
    delivered: false,
    contractTerminatedAt: 200,
  }));
  assert.ok(terminationBeforeDelivery.some((x) => x.code === 'TERMINATED_NOT_DELIVERED'));
});

test('인도일과 정산 chronology 모순을 잡는다', () => {
  assert.ok(workflowConsistencyIssues(row({
    deliveredAt: '2026-02-30',
  })).some((x) => x.code === 'DELIVERY_DATE_INVALID'));

  assert.ok(workflowConsistencyIssues(row({
    receivedAt: '2026-09-20',
    deliveredAt: '2026-09-10',
  })).some((x) => x.code === 'DELIVERY_BEFORE_INTAKE'));

  assert.ok(workflowConsistencyIssues(row({
    delivered: false,
    billed: true,
    claimStage: '청구',
  })).some((x) => x.code === 'FINANCIAL_ACTIVITY_BEFORE_DELIVERY'));
});

test('청구/계산서/수금/지급 단계의 확실한 모순을 잡는다', () => {
  assert.ok(workflowConsistencyIssues(row({
    billed: false,
    invoiceIssued: true,
  })).some((x) => x.code === 'INVOICE_WITHOUT_BILL'));

  assert.ok(workflowConsistencyIssues(row({
    collected: true,
    claimStage: '확인',
  })).some((x) => x.code === 'COLLECTED_STAGE_MISMATCH'));

  assert.ok(workflowConsistencyIssues(row({
    paid: true,
    payStage: '확인',
  })).some((x) => x.code === 'PAID_STAGE_MISMATCH'));

  assert.ok(workflowConsistencyIssues(row({
    billed: true,
    billHold: true,
  })).some((x) => x.code === 'BILL_HOLD_AFTER_BILL'));
});

test('모순 row는 읽을 수 있어도 정산 mutation은 더 진행하지 않는다', () => {
  const dirty = row({
    billed: false,
    invoiceIssued: true,
    claimStage: '확인',
  });
  const reason = workflowMutationBlockedReason(dirty);
  assert.match(String(reason), /업무 상태가 서로 맞지 않습니다/);

  const result = lifePatch(dirty, { kind: 'confirm', axis: '영업채널' }, Date.parse('2026-09-26T12:00:00+09:00'));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /업무 상태가 서로 맞지 않습니다/);
});

test('모순 row는 환수 원장도 새로 만들지 않는다', () => {
  const dirty = row({
    billed: true,
    invoiceIssued: true,
    collected: true,
    collectedAmt: 110000,
    claimStage: '확인',
  });
  const result = clawbackRecord(
    dirty,
    { at: '2026-09-26', supplierAmt: 10000, agentAmt: 0, reason: '테스트' },
    'tester',
    Date.parse('2026-09-26T12:00:00+09:00'),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /업무 상태가 서로 맞지 않습니다/);
});

test('legacy에서 날짜만 남긴 인도취소처럼 현재 규칙상 허용되는 보존 사실은 모순으로 잡지 않는다', () => {
  const reverted = row({
    delivered: false,
    deliveredAt: '2026-09-10',
    claimStage: '접수',
    payStage: '접수',
  });
  assert.deepEqual(workflowConsistencyIssues(reverted), []);
});
