import test from 'node:test';
import assert from 'node:assert/strict';
import { contractIntakeLinkError } from './link';

test('missing legacy link is tolerated', () => {
  assert.equal(contractIntakeLinkError('ctr_1',{}),null);
});

test('matching intake link is accepted', () => {
  assert.equal(contractIntakeLinkError('ctr_1',{esignContractId:'ctr_1'}),null);
});

test('mismatched intake link fails closed', () => {
  assert.match(String(contractIntakeLinkError('ctr_1',{esignContractId:'ctr_2'})),/다른 계약/);
});
