import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizationBlockReason } from './finalization-gate';

test('active contract is eligible for finalization gate', () => {
  assert.equal(finalizationBlockReason({contract_status:'계약완료'},{cancelled:false}),null);
});

test('contract cancellation blocks esign finalization from either projection', () => {
  assert.match(String(finalizationBlockReason({contract_status:'계약취소'},{cancelled:false})),/계약취소/);
  assert.match(String(finalizationBlockReason({contract_status:'계약완료'},{cancelled:true})),/계약취소/);
  assert.match(String(finalizationBlockReason({contract_status:'계약완료'},{contractCancelledAt:1})),/계약취소/);
  assert.match(String(finalizationBlockReason({contract_status:'계약완료'},{cancelled:'참'})),/계약취소/);
});

test('contract termination blocks esign finalization from either projection', () => {
  assert.match(String(finalizationBlockReason({contract_status:'계약해지'},{cancelled:false})),/계약해지/);
  assert.match(String(finalizationBlockReason({contract_status:'계약완료'},{contractTerminatedAt:1})),/계약해지/);
});
