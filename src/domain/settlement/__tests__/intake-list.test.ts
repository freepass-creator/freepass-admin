import test from 'node:test';
import assert from 'node:assert/strict';
import { sortIntakeRows } from '../intake-list';
import type { SettlementRow } from '../types';

const row = (id: string, receivedAt: string): SettlementRow => ({
  id,
  plate: null,
  receivedAt,
  customer: id,
  supplier: '공급사',
  supplierCode: null,
  channel: '영업채널',
  channelCode: null,
  agent: '담당',
  agentCode: null,
  model: '차량',
  product: '장기렌트',
  rentKind: '재렌트',
  contractType: '전자약정',
  term: 36,
  rent: 100,
  deposit: 0,
  price: null,
  payKind: '일시납',
  paidRounds: null,
  progress: {
    paper: false,
    delivered: false,
    deliveredAt: null,
    cancelled: false,
    billed: false,
    billMonth: null,
    billedAt: null,
    invoiceIssued: false,
    invoiceAt: null,
    invoiceBiz: null,
    collected: false,
    collectedAmt: null,
    paid: false,
    paidAmt: null,
    supplierOk: false,
    channelOk: false,
    billHold: false,
    settleExclude: false,
  },
  claimStage: '접수',
  payStage: '접수',
  supplierFee: { mode: 'UNKNOWN', raw: null },
  channelFee: { mode: 'UNKNOWN', raw: null },
  money: {
    claim: null, pay: null, claimIncentive: null, payIncentive: null,
    claimAdjust: null, payAdjust: null, adjustReason: null,
    promoShare: null, promoReason: null, carryClaim: null, carryPay: null,
    carryMonth: null, carryNote: null, prepaid: null, vatIncluded: false,
  },
  settleTarget: '양쪽',
  settleRatio: 1,
  note: null,
  settleNote: null,
  source: { rowNo: null, tab: null, sheet: null },
});

test('미완료 접수는 가장 오래 방치된 건부터 보여준다', () => {
  const rows = [row('new', '2026-08-31'), row('old', '2026-06-01'), row('mid', '2026-07-15')];
  assert.deepEqual(sortIntakeRows(rows, '미완료').map((x) => x.id), ['old', 'mid', 'new']);
});

test('일반 접수·실적·전체는 최신 건부터 보여준다', () => {
  const rows = [row('new', '2026-09-21'), row('old', '2026-09-01'), row('mid', '2026-09-10')];
  assert.deepEqual(sortIntakeRows(rows, '당월접수').map((x) => x.id), ['new', 'mid', 'old']);
  assert.deepEqual(sortIntakeRows(rows, 'all').map((x) => x.id), ['new', 'mid', 'old']);
});

test('같은 접수일은 id 순으로 고정해 화면 순서가 흔들리지 않는다', () => {
  const rows = [row('b', '2026-09-01'), row('a', '2026-09-01')];
  assert.deepEqual(sortIntakeRows(rows, '미완료').map((x) => x.id), ['a', 'b']);
});
