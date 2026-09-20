import assert from 'node:assert/strict';
import test from 'node:test';
import { partnerTypeLabel, UNCLASSIFIED_PARTNER_TYPE } from './partner-type';

test('partner type normalizes legacy and current labels',()=>{
  assert.equal(partnerTypeLabel('provider'),'공급사');
  assert.equal(partnerTypeLabel('sales-channel'),'영업채널');
  assert.equal(partnerTypeLabel('채널'),'영업채널');
  assert.equal(partnerTypeLabel('operator'),'운영사');
});

test('legacy code prefix is only a fallback when type is absent or generic',()=>{
  assert.equal(partnerTypeLabel('', 'RP016'),'공급사');
  assert.equal(partnerTypeLabel('파트너','SP001'),'영업채널');
  assert.equal(partnerTypeLabel('', 'UNKNOWN'),UNCLASSIFIED_PARTNER_TYPE);
  assert.equal(partnerTypeLabel('기타','SP001'),'기타');
});
