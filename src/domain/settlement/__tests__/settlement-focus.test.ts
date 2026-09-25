import test from 'node:test';
import assert from 'node:assert/strict';
import { claimLedger, ledgerMonths, locateSettlementFocus, settlementEligible } from '../ledgers';
import type { SettlementRow } from '../types';

const row = (o: Partial<SettlementRow> = {}): SettlementRow => ({
  id: 'stl_focus',
  plate: '12가3456',
  receivedAt: '2026-09-01',
  customer: '홍길동',
  supplier: '공급사A',
  supplierCode: null,
  channel: '영업채널A',
  channelCode: null,
  agent: '담당',
  agentCode: null,
  model: '차량',
  product: '장기렌트',
  rentKind: '재렌트',
  contractType: '전자약정',
  term: 36,
  rent: 500000,
  deposit: 0,
  price: null,
  payKind: '일시납',
  paidRounds: null,
  progress: {
    paper: true,
    delivered: true,
    deliveredAt: '2026-09-10',
    cancelled: false,
    billed: false,
    billMonth: '2026-09',
    billedAt: null,
    invoiceIssued: false,
    invoiceAt: null,
    invoiceBiz: null,
    collected: false,
    collectedAmt: 0,
    paid: false,
    paidAmt: 0,
    supplierOk: false,
    channelOk: false,
    billHold: false,
    settleExclude: false,
  },
  claimStage: '접수',
  payStage: '접수',
  supplierFee: { mode: 'FLAT', amount: 100000 },
  channelFee: { mode: 'FLAT', amount: 80000 },
  money: {
    claim: 100000, pay: 80000, claimIncentive: 0, payIncentive: 0,
    claimAdjust: 0, payAdjust: 0, adjustReason: null,
    promoShare: null, promoReason: null, carryClaim: 0, carryPay: 0,
    carryMonth: null, carryNote: null, prepaid: 0, vatIncluded: false,
  },
  settleTarget: '양쪽',
  settleRatio: 1,
  note: null,
  settleNote: null,
  source: { rowNo: null, tab: null, sheet: null },
  ...o,
});

test('접수 코드로 정확한 청구 달·공급사 묶음을 찾는다', () => {
  assert.deepEqual(
    locateSettlementFocus([row()], [], 'stl_focus', 'claim', new Date('2026-09-21T00:00:00+09:00')),
    { tab: 'claim', month: '2026-09', party: '공급사A', code: 'stl_focus' },
  );
});

test('접수 코드로 정확한 지급 달·영업채널 묶음을 찾는다', () => {
  assert.deepEqual(
    locateSettlementFocus([row()], [], 'stl_focus', 'pay', new Date('2026-09-21T00:00:00+09:00')),
    { tab: 'pay', month: '2026-09', party: '영업채널A', code: 'stl_focus' },
  );
});

test('상대가 없거나 원장에 설 수 없는 줄은 다른 묶음으로 추측하지 않는다', () => {
  assert.equal(locateSettlementFocus([row({ channel: null })], [], 'stl_focus', 'pay'), null);
  assert.equal(locateSettlementFocus([row({ progress: { ...row().progress, paper: false } })], [], 'stl_focus', 'claim'), null);
  assert.equal(locateSettlementFocus([row()], [], '없는코드', 'claim'), null);
});


test('인도 전 줄은 billMonth가 미리 박혀 있어도 정산 원장에 서지 않는다', () => {
  const dirty = row({
    progress: {
      ...row().progress,
      delivered: false,
      deliveredAt: null,
      billMonth: '2026-09',
    },
  });
  assert.equal(settlementEligible(dirty), false);
  assert.deepEqual(ledgerMonths([dirty], [], new Date('2026-09-21T00:00:00+09:00')), []);
  assert.deepEqual(claimLedger([dirty], '2026-09', [], new Date('2026-09-21T00:00:00+09:00')), []);
  assert.equal(locateSettlementFocus([dirty], [], 'stl_focus', 'claim'), null);
});

test('인도완료 boolean만 있고 인도일이 없으면 정산 원장에 서지 않는다', () => {
  const incomplete = row({
    progress: {
      ...row().progress,
      delivered: true,
      deliveredAt: null,
      billMonth: '2026-09',
    },
  });
  assert.equal(settlementEligible(incomplete), false);
  assert.equal(locateSettlementFocus([incomplete], [], 'stl_focus', 'claim'), null);
});
