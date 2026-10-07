import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthlyInvoice, dueDateOf, monthlyInvoiceHtml } from '../invoice-document';

const issuer = { name:'프리패스모빌리티 주식회사', bizNo:'528-88-02988', bank:'신한은행', account:'140-014-462206', holder:'프리패스모빌리티 주식회사', manager:'프리패스 매니저', phone:'010-6393-0926', email:'pyh@teamjpk.com' };
const receiver = { name:'우리캐피탈렌터카', bizNo:'142-81-15688' };

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
  const invoice = buildMonthlyInvoice({ month:'2026-09', supplier:'우리캐피탈', issuer, receiver, rows:[
    { plate:'133하4554', receivedAt:'2026-08-11', supplier:'우리캐피탈', customer:'박시은', model:'그랜저', product:'선출고', term:60, price:52_550_000, supplierRate:.035, claim:1_839_250, claimVat:183_925, claimTotal:2_023_175, billMonth:'2026-09', delivered:true, cancelled:false },
    { plate:'제외', receivedAt:'2026-08-12', supplier:'우리캐피탈', claim:100, billMonth:'2026-09', delivered:false, cancelled:false },
  ] });
  assert.equal(invoice.lines.length, 1);
  assert.equal(invoice.total, 2_023_175);
  assert.equal(invoice.lines[0].formula, '산출: 차량가액 52,550,000원 × 3.5%');
  const html = monthlyInvoiceHtml(invoice);
  for (const expected of ['신한은행', '140-014-462206', '2026. 10. 10', '2,023,175', '차량가액 52,550,000원 × 3.5%']) assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('시트 청구합계와 공급가+부가세가 다르면 발행을 막는다', () => {
  assert.throws(() => buildMonthlyInvoice({ month:'2026-09', supplier:'우리캐피탈', issuer, receiver, rows:[
    { plate:'133하4554', receivedAt:'2026-08-11', supplier:'우리캐피탈', claim:100, claimVat:10, claimTotal:999, billMonth:'2026-09', delivered:true, cancelled:false },
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
