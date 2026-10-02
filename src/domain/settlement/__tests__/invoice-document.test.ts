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
