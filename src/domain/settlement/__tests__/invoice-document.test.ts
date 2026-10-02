import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthlyInvoice, dueDateOf, monthlyInvoiceHtml } from '../invoice-document';

const issuer = { name:'프리패스모빌리티 주식회사', bizNo:'528-88-02988', bank:'신한은행', account:'140-014-462206', holder:'프리패스모빌리티 주식회사', manager:'프리패스 매니저', phone:'010-6393-0926', email:'pyh@teamjpk.com' };
const receiver = { name:'우리캐피탈렌터카', bizNo:'142-81-15688' };

test('다음 달 10일을 입금 요청일로 만든다', () => {
  assert.equal(dueDateOf('2026-09'), '2026-10-10');
  assert.equal(dueDateOf('2026-12'), '2027-01-10');
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
