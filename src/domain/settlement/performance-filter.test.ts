import assert from 'node:assert/strict';
import test from 'node:test';
import type { LedgerLine } from './ledgers';
import type { SettlementRow } from './types';
import { filterPerformanceLines, nextActionablePerformanceCode, performanceMatchesMode } from './performance-filter';

const row = (o: Partial<SettlementRow> = {}): SettlementRow => ({
  id:'r1', plate:'12가3456', receivedAt:'2026-09-01', customer:'홍길동',
  supplier:'공급A', supplierCode:null, channel:'채널A', channelCode:null, agent:'김영업', agentCode:null, model:'싼타페',
  product:'장기렌트', rentKind:'재렌트', contractType:null, term:36, rent:700000, deposit:0, price:null, payKind:'일시납', paidRounds:null,
  progress:{
    paper:true, delivered:true, deliveredAt:'2026-09-02', cancelled:false,
    billed:true, billMonth:'2026-09', billedAt:null, invoiceIssued:true, invoiceAt:null, invoiceBiz:null,
    collected:false, collectedAmt:null, paid:false, paidAmt:null, supplierOk:false, channelOk:false, billHold:false, settleExclude:false,
  },
  claimStage:'확인', payStage:'확인',
  supplierFee:{mode:'RATE',rate:.03}, channelFee:{mode:'RATE',rate:.02},
  money:{claim:100,pay:50,claimIncentive:null,payIncentive:null,claimAdjust:null,payAdjust:null,adjustReason:null,promoShare:null,promoReason:null,carryClaim:null,carryPay:null,carryMonth:null,carryNote:null,prepaid:null,vatIncluded:false},
  settleTarget:'양쪽', settleRatio:1, note:null, settleNote:null,
  source:{rowNo:null,tab:null,sheet:null},
  ...o,
});

const line = (r: SettlementRow, o: Partial<LedgerLine> = {}): LedgerLine => ({ row:r, month:'2026-09', amount:100, broken:false, ratio:1, ...o });

test('performance modes separate todo issue and done from authoritative ledger state',()=>{
  const todo=line(row());
  const issue=line(row({progress:{...row().progress,billHold:true}}));
  const done=line(row({progress:{...row().progress,collected:true,paid:true}}));
  assert.equal(performanceMatchesMode(todo,'공급사','todo'),true);
  assert.equal(performanceMatchesMode(todo,'공급사','issue'),false);
  assert.equal(performanceMatchesMode(issue,'공급사','issue'),true);
  assert.equal(performanceMatchesMode(issue,'공급사','todo'),false);
  assert.equal(performanceMatchesMode(done,'공급사','done'),true);
  assert.equal(performanceMatchesMode(done,'공급사','todo'),false);
  assert.equal(performanceMatchesMode(done,'공급사','issue'),false);
});

test('pay axis does not treat supplier bill hold as a pay issue',()=>{
  const held=line(row({progress:{...row().progress,billHold:true}}));
  assert.equal(performanceMatchesMode(held,'영업채널','issue'),false);
});

test('performance search spans customer plate model parties agent and id',()=>{
  const lines=[line(row())];
  assert.equal(filterPerformanceLines(lines,'공급사','all','홍길동').length,1);
  assert.equal(filterPerformanceLines(lines,'공급사','all','12가3456').length,1);
  assert.equal(filterPerformanceLines(lines,'공급사','all','김영업').length,1);
  assert.equal(filterPerformanceLines(lines,'공급사','all','없는값').length,0);
});


test('next actionable performance moves to the next unfinished row without touching state',()=>{
  const a=line(row({id:'a'}));
  const b=line(row({id:'b'}));
  const done=line(row({id:'done',progress:{...row().progress,collected:true}}));
  assert.equal(nextActionablePerformanceCode([a,b,done],'공급사','a'),'b');
  assert.equal(nextActionablePerformanceCode([a,b,done],'공급사','b'),'a');
  assert.equal(nextActionablePerformanceCode([done,b],'공급사','done'),'b');
  assert.equal(nextActionablePerformanceCode([done],'공급사','done'),null);
});
