import test from 'node:test';
import assert from 'node:assert/strict';
import { settlementPrimaryAction } from '../primary-action';
import type { SettlementRow } from '../../../domain/settlement/types';

const row = (claimStage: string, payStage: string, invoiceIssued = false) => ({
  receivedAt: '2026-09-01',
  contractCancelledAt: null,
  contractTerminatedAt: null,
  claimStage,
  payStage,
  progress: {
    paper: true,
    delivered: true,
    deliveredAt: '2026-09-10',
    cancelled: false,
    billed: claimStage !== '접수',
    billMonth: '2026-09',
    billedAt: claimStage !== '접수' ? '2026-09-15' : null,
    invoiceIssued,
    invoiceAt: invoiceIssued ? '2026-09-16' : null,
    invoiceBiz: invoiceIssued ? '1234567890' : null,
    collected: claimStage === '수금',
    collectedAmt: claimStage === '수금' ? 100 : 0,
    paid: payStage === '지급',
    paidAmt: payStage === '지급' ? 100 : 0,
    supplierOk: claimStage === '확인' || claimStage === '수금',
    channelOk: payStage === '확인' || payStage === '지급',
    billHold: false,
    settleExclude: false,
  },
}) as unknown as SettlementRow;

test('공급사 축은 확인 뒤 계산서를 먼저 끝내고 수금으로 간다', () => {
  assert.equal(settlementPrimaryAction(row('청구', '통보'), '공급사'), 'confirm');
  assert.equal(settlementPrimaryAction(row('확인', '통보', false), '공급사'), 'invoice');
  assert.equal(settlementPrimaryAction(row('확인', '통보', true), '공급사'), 'cash');
  assert.equal(settlementPrimaryAction(row('수금', '통보', true), '공급사'), 'done');
});

test('영업채널 축은 확인 뒤 바로 지급으로 간다', () => {
  assert.equal(settlementPrimaryAction(row('청구', '통보'), '영업채널'), 'confirm');
  assert.equal(settlementPrimaryAction(row('청구', '확인'), '영업채널'), 'cash');
  assert.equal(settlementPrimaryAction(row('청구', '지급'), '영업채널'), 'done');
});

test('정정은 풀기 전까지 다른 주 액션으로 가지 않는다', () => {
  assert.equal(settlementPrimaryAction(row('정정', '통보'), '공급사'), 'uncorrect');
  assert.equal(settlementPrimaryAction(row('청구', '정정'), '영업채널'), 'uncorrect');
});


test('업무 사실이 모순된 줄은 완료/다음단계 대신 데이터 확인으로 막는다', () => {
  const dirty = {
    ...row('수금', '지급', true),
    progress: {
      ...row('수금', '지급', true).progress,
      delivered: false,
      deliveredAt: '2026-09-10',
    },
  } as SettlementRow;
  assert.equal(settlementPrimaryAction(dirty, '공급사'), 'none');
  assert.equal(settlementPrimaryAction(dirty, '영업채널'), 'none');
});
