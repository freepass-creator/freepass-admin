import { mkdirSync, writeFileSync } from 'node:fs';
import { buildInvoice, type InvoiceParty } from 'file:///C:/dev/freepasserp4/lib/domain/settlement-invoice.ts';
import { invoiceDocHtml, invoicePageHtml } from 'file:///C:/dev/freepasserp4/lib/server/settlement-invoice-html.ts';
import { CORP } from 'file:///C:/dev/freepasserp4/lib/domain/corporate-ci.ts';
import { ciOf } from 'file:///C:/dev/freepasserp4/lib/domain/partner-ci.ts';
import type { SettlementRow } from 'file:///C:/dev/freepasserp4/lib/domain/settlement-stage.ts';

const outDir = 'C:/Users/admin/.codex/worktrees/woori-invoice-account/freepass-admin/output/pdf';
mkdirSync(outDir, { recursive: true });

const issuer: InvoiceParty = {
  name: CORP.name,
  bizNo: CORP.bizNo,
  ceo: CORP.ceo,
  address: CORP.addr,
  phone: CORP.phone,
  bank: '신한은행',
  account: '140-014-462206',
  holder: '프리패스모빌리티 주식회사',
};

const ci = ciOf('우리캐피탈');
const receiver: InvoiceParty = {
  name: ci?.legal ?? '우리캐피탈렌터카 주식회사',
  bizNo: ci?.bizNo ?? '142-81-15688',
  ceo: ci?.ceo ?? '',
  address: ci?.addr ?? '',
  phone: ci?.tel ?? '',
  bank: '',
  account: '',
  holder: '',
};

const row: SettlementRow = {
  paper: true,
  delivered: true,
  cancelled: false,
  clawback: false,
  billMonth: '2026-09',
  settleTarget: '모두',
  settleRatio: 1,
  billHold: false,
  settleExclude: false,
  vatIncluded: false,
  plate: '133하4554',
  supplier: '우리캐피탈',
  agent: '양정욱',
  channel: 'SMC',
  customer: '박시은',
  model: '그랜저',
  product: '선출고',
  term: 60,
  rent: 1_090_000,
  price: 52_550_000,
  payKind: '2회분납',
  paidRounds: 2,
  deposit: 1_300_000,
  receivedAt: new Date(2026, 7, 11),
  deliveredAt: new Date(2026, 7, 11),
  clawbackAt: null,
  clawbackAmount: 0,
  claimWritten: 1_839_250,
  payWritten: 1_576_500,
  supplierRate: 0.035,
  agentRate: 0.03,
};

const invoice = buildInvoice({
  axis: '공급사',
  month: '2026-09',
  party: '우리캐피탈',
  issuer,
  receiver,
  rows: [row],
  clawbacks: [],
});

if (invoice.supply !== 1_839_250 || invoice.vat !== 183_925 || invoice.total !== 2_023_175) {
  throw new Error(`금액 불일치: ${JSON.stringify({ supply: invoice.supply, vat: invoice.vat, total: invoice.total })}`);
}
if (invoice.missing.some((item) => item.includes('입금계좌'))) {
  throw new Error(`입금계좌 누락: ${invoice.missing.join(', ')}`);
}

const html = invoicePageHtml('2026-09 청구서 우리캐피탈', invoiceDocHtml(invoice))
  .replace(
    '</style></head>',
    '.ctab .calc{display:block;margin-top:3px;font-size:8.5px;line-height:1.25;color:#5f6b7a;font-weight:500;white-space:nowrap}</style></head>',
  )
  .replace(
    '<span class="sub">박*은 · 선출고 · 60개월</span>',
    '<span class="sub">박*은 · 선출고 · 60개월</span><span class="calc">산출: 차량가액 52,550,000원 × 3.5%</span>',
  );

const path = `${outDir}/우리캐피탈_2026년09월_청구서_계좌반영.pdf.html`;
writeFileSync(path, html, 'utf8');
console.log(path);
