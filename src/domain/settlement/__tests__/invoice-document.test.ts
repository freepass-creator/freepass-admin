import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthlyInvoice, dueDateOf, monthlyInvoiceHtml } from '../invoice-document';

const issuer = { name:'프리패스모빌리티 주식회사', bizNo:'000-00-00000', bank:'테스트은행', account:'000-0000-000000', holder:'프리패스모빌리티 주식회사', manager:'프리패스 매니저', phone:'010-0000-0000', email:'EMAIL_REDACTED' };
const receiver = { name:'예시수신사', bizNo:'999-99-99999' };

test('다음 달 10일을 입금 요청일로 만든다', () => {
  assert.equal(dueDateOf('2026-09'), '2026-10-10');
  assert.equal(dueDateOf('2026-12'), '2027-01-10');
});

test('같은 9월 필터 안에서도 과거 기청구·환수전용은 재청구하지 않고 이번 잔여만 발행한다', () => {
  const base = { supplier:'검증공급사', receivedAt:'2026-08-01', billMonth:'2026-09', delivered:true, cancelled:false };
  const invoice = buildMonthlyInvoice({ month:'2026-09', supplier:'검증공급사', issuer, receiver, rows:[
    { ...base, plate:'기청구', claim:1000, billed:true },
    { ...base, plate:'과거이력', claim:1000, billState:'기청구·재청구금지' },
    { ...base, plate:'환수', claim:1000, billState:'환수전용·재청구금지' },
    { ...base, plate:'이번잔여', claim:300, claimVat:30, claimTotal:330, billed:false, billState:'잔여청구대상·미발행' },
  ] });
  assert.deepEqual(invoice.lines.map(r => r.plate), ['이번잔여']);
  assert.equal(invoice.total, 330);
});

test('접수 앞뒤 기재액 충돌은 청구서로 조용히 넘어가지 않는다', () => {
  assert.throws(() => buildMonthlyInvoice({ month:'2026-09', supplier:'검증공급사', issuer, receiver, rows:[
    { supplier:'검증공급사', plate:'충돌행', receivedAt:'2026-09-01', billMonth:'2026-09', delivered:true, claim:100, moneyConflicts:['청구액/판매수수료 불일치'] },
  ] }), /접수 금액 불일치/);
});

test('금액을 입력해도 미확정·원본충돌·검증보류 상태는 확정 청구로 발행하지 않는다', () => {
  const base = { supplier:'검증공급사', receivedAt:'2026-09-01', billMonth:'2026-09', delivered:true, claim:100, claimVat:10, claimTotal:110 };
  const invoice = buildMonthlyInvoice({ month:'2026-09', supplier:'검증공급사', issuer, receiver, rows:[
    ...['청구금액미확정', '청구검증보류', '원본충돌', '정산불가'].map(billState => ({ ...base, plate:billState, billState })),
    { ...base, plate:'확정행', billState:'청구대상·미발행' },
  ] });
  assert.deepEqual(invoice.lines.map(r => r.plate), ['확정행']);
});

test('F04 월·공급사·인도완료 행만 청구서로 묶고 차량가액 산출식을 남긴다', () => {
  const invoice = buildMonthlyInvoice({ month:'2026-09', supplier:'예시금융사', issuer, receiver, rows:[
    { plate:'PLATE_SAMPLE_A', receivedAt:'2026-08-11', supplier:'예시금융사', customer:'고객 A', model:'그랜저', product:'선출고', term:60, price:52_550_000, supplierRate:.035, claim:1_839_250, claimVat:183_925, claimTotal:2_023_175, billMonth:'2026-09', delivered:true, cancelled:false },
    { plate:'제외', receivedAt:'2026-08-12', supplier:'예시금융사', claim:100, billMonth:'2026-09', delivered:false, cancelled:false },
  ] });
  assert.equal(invoice.lines.length, 1);
  assert.equal(invoice.total, 2_023_175);
  assert.equal(invoice.lines[0].formula, '산출: 차량가액 52,550,000원 × 3.5%');
  const html = monthlyInvoiceHtml(invoice);
  for (const expected of ['테스트은행', '000-0000-000000', '2026. 10. 10', '2,023,175', '차량가액 52,550,000원 × 3.5%']) assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('시트 청구합계와 공급가+부가세가 다르면 발행을 막는다', () => {
  assert.throws(() => buildMonthlyInvoice({ month:'2026-09', supplier:'예시금융사', issuer, receiver, rows:[
    { plate:'PLATE_SAMPLE_A', receivedAt:'2026-08-11', supplier:'예시금융사', claim:100, claimVat:10, claimTotal:999, billMonth:'2026-09', delivered:true, cancelled:false },
  ] }), /청구금액 불일치/);
});

test('하허호 방식으로 확정 출고만 남기고 지급환수는 별도 음수 행과 소계로 표시한다', () => {
  const invoice = buildMonthlyInvoice({ month:'2026-09', supplier:'하허호', issuer, receiver, rows:[
    { plate:'정상출고', receivedAt:'2026-09-01', supplier:'하허호', product:'프리패스', claim:1_000_000, claimVat:100_000, claimTotal:1_100_000, billMonth:'2026-09', delivered:true, cancelled:false },
    { plate:'취소행', receivedAt:'2026-09-02', supplier:'하허호', claim:2_000_000, billMonth:'2026-09', delivered:true, cancelled:true },
    { plate:'지급제외행', receivedAt:'2026-09-03', supplier:'하허호', claim:3_000_000, billMonth:'2026-09', delivered:true, cancelled:false, settleExclude:true },
    { plate:'보류행', receivedAt:'2026-09-04', supplier:'하허호', claim:4_000_000, billMonth:'2026-09', delivered:true, cancelled:false, billHold:true },
    { plate:'오플출고', receivedAt:'2026-09-05', supplier:'하허호', product:'오플', claim:700_000, claimVat:70_000, claimTotal:770_000, billMonth:'2026-09', delivered:true, cancelled:false },
  ], clawbacks:[{ plate:'환수차량', supplier:'하허호', product:'프리패스', month:'2026-09', supplierAmt:100_000, reason:'계약 해지', at:'2026-09-30' }] });
  assert.equal(invoice.claimLineCount,2); assert.equal(invoice.clawbackLineCount,1); assert.equal(invoice.lines.length,3);
  assert.deepEqual(invoice.groups.map(({ product,lines,claims,clawbacks,total }) => ({ product,lines,claims,clawbacks,total })), [{ product:'프리패스',lines:2,claims:1,clawbacks:1,total:990_000 },{ product:'오플',lines:1,claims:1,clawbacks:0,total:770_000 }]);
  assert.deepEqual({ supply:invoice.supply, vat:invoice.vat, total:invoice.total }, { supply:1_600_000, vat:160_000, total:1_760_000 });
  const html=monthlyInvoiceHtml(invoice);
  for (const expected of ['3건 (출고 2건 + 지급환수 1건)','프리패스 <small>2건 (출고 1 + 지급환수 1)','오플 <small>1건','지급환수 · 계약 해지','지급환수 소계','-100,000','총합계']) assert.ok(html.includes(expected));
  for (const excluded of ['취소행','지급제외행','보류행','ROUND','HOLD','지급 제외']) assert.ok(!html.includes(excluded));
});


import {buildReceiptDocuments,receiptVat,type ReceiptDocumentConfig} from '../invoice-document';
import {invoiceDocHtml,invoicePageHtml,type DocumentBranding} from '../../../adapters/erp5/settlement-invoice-html';
const documentParty={name:'검증',bizNo:'0000000000',ceo:'',address:'',phone:'',bank:'',account:'',holder:''};
const documentConfig:ReceiptDocumentConfig={issuer:documentParty,parties:{공급:{...documentParty,name:'공급 법인'},영업채널A:{...documentParty,name:'채널 법인'}},channelAliases:{영업채널A별칭:'영업채널A'}};
const booked=(claim:number,pay:number,extra:Record<string,unknown>={})=>({sourceReceiptRaw:Array.from({length:20},(_,i)=>i===18?'2026':i===19?'09':null),sourceReceiptClaim:claim,sourceReceiptPay:pay,supplier:'공급',channel:'영업채널A별칭',plate:'검증차량',receivedAt:'2026-09-01',...extra});
test('one month documents use signed row VAT, same-entity channel and legal receiver; original amounts remain unchanged',()=>{
  const rows=[booked(15,15),booked(0,-5,{channel:'영업채널A',receivedAt:'',settlementEntryKind:'OVERPAYMENT_CORRECTION'}),booked(999,999,{cancelled:true})];
  const original=JSON.stringify(rows);
  const docs=buildReceiptDocuments({month:'2026-09',rows,summary:{count:2,claimAmount:15,payAmount:10},config:documentConfig});
  assert.equal(docs.length,2);assert.equal(docs[1].party,'영업채널A');assert.equal(docs[1].receiver.name,'채널 법인');
  assert.deepEqual([docs[0].supply,docs[0].vat,docs[1].supply,docs[1].vat],[15,2,10,1]);
  assert.equal(receiptVat(-5),-1);assert.equal(receiptVat(0),0);assert.equal(JSON.stringify(rows),original);
  assert.ok(docs[1].missing.includes('접수일 미기재 건 포함'));
});
test('published counts, missing supply, legacy amounts and sums cannot silently create documents',()=>{
  for(const [rows,summary] of [
    [[booked(100,80)],{count:2,claimAmount:100,payAmount:80}],
    [[booked(100,80,{sourceReceiptClaim:null,claimWritten:100})],{count:1,claimAmount:100,payAmount:80}],
    [[booked(100,80)],{count:1,claimAmount:101,payAmount:80}],
  ] as [Record<string,unknown>[],{count:number;claimAmount:number;payAmount:number}][]){
    assert.throws(()=>buildReceiptDocuments({month:'2026-09',rows,summary,config:documentConfig}));
  }
});
test('held flags stay visible while held rows stay out of counterparty totals',()=>{
  const rows=Array.from({length:24},(_,i)=>booked(100,80,{plate:String(i),billHold:i===0,customer:'<script>bad</script>'}));
  const d=buildReceiptDocuments({month:'2026-09',rows,summary:{count:24,claimAmount:2300,payAmount:1840},config:documentConfig})[0];
  const branding={name:'검증',markMain:'freepass',markSub:'mobility',erpMain:'freepass',erpSub:'erp',tagline:'검증'} as DocumentBranding;
  const html=invoicePageHtml('검증',invoiceDocHtml(d,{branding,issuedAt:1}));
  assert.equal(d.lines.length,23);
  assert.ok(html.includes('공급사 확정 별도 확인'));assert.ok(html.includes('일정 확인 필요'));
  assert.ok(!html.includes('class="warn noprint"'));assert.ok(!html.includes('<script>bad</script>'));
});
