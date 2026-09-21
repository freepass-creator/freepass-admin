import test from 'node:test';
import assert from 'node:assert/strict';
import { settlementPrimaryAction } from '../primary-action';

const row = (claimStage: string, payStage: string, invoiceIssued = false) => ({
  claimStage,
  payStage,
  progress: { invoiceIssued },
}) as never;

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
