import assert from 'node:assert/strict';
import test from 'node:test';
import type { LedgerGroup } from '../../domain/settlement/ledgers';
import { settlementGroupSignal, settlementGroupSupport, settlementLineSignal } from './group-signal';

const group = (patch: Partial<LedgerGroup> = {}, claimStage = '접수', payStage = '접수'): LedgerGroup => ({
  party: '테스트',
  lines: [{
    row: { claimStage, payStage } as never,
    month: '2026-09',
    amount: 100,
    broken: false,
    ratio: 1,
  }],
  rows: [],
  total: 100,
  unknown: 0,
  done: 0,
  completed: 0,
  hold: 0,
  forecast: 0,
  broken: 0,
  clawbacks: [],
  clawbackTotal: 0,
  net: 100,
  ...patch,
});

test('settlement group signal exposes blocking facts before generic progress', () => {
  assert.deepEqual(settlementGroupSignal(group({ unknown: 1, hold: 1 }), 'claim'), {
    key: 'amount-unknown', label: '금액 모름', tone: 'error',
  });
  assert.deepEqual(settlementGroupSignal(group({ broken: 1 }), 'claim'), {
    key: 'broken', label: '끊김', tone: 'error',
  });
  assert.deepEqual(settlementGroupSignal(group({}, '정정'), 'claim'), {
    key: 'correction', label: '정정', tone: 'error',
  });
  assert.deepEqual(settlementGroupSignal(group({ hold: 1 }), 'claim'), {
    key: 'hold', label: '보류', tone: 'warning',
  });
});

test('settlement group signal distinguishes done, progress, and waiting', () => {
  assert.deepEqual(settlementGroupSignal(group({ completed: 1, done: 1 }), 'claim'), {
    key: 'done', label: '완료', tone: 'success',
  });
  assert.deepEqual(settlementGroupSignal(group({ done: 1 }), 'claim'), {
    key: 'progress', label: '진행', tone: 'info',
  });
  assert.deepEqual(settlementGroupSignal(group(), 'claim'), {
    key: 'waiting', label: '대기', tone: 'neutral',
  });
});

test('settlement group support includes correction and hold without adding a fourth card line', () => {
  const g = group({ hold: 1, broken: 1 }, '정정');
  assert.equal(settlementGroupSupport(g, 'claim'), '끊김 1 · 정정 1 · 외 1');
});

test('settlement line signal keeps hold/correction/broken semantics aligned across shells', () => {
  assert.equal(settlementLineSignal('청구', { hold: true }).label, '보류');
  assert.equal(settlementLineSignal('정정').tone, 'error');
  assert.equal(settlementLineSignal('확인').tone, 'info');
  assert.equal(settlementLineSignal('수금').tone, 'success');
});
