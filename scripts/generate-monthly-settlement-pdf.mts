import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { buildMonthlyInvoice, monthlyInvoiceHtml, type SheetClawbackRow, type SheetSettlementRow } from '../src/domain/settlement/invoice-document';

const arg = (name: string, fallback = '') => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] ?? fallback : fallback; };
const month = arg('--month');
const supplier = arg('--supplier', '우리캐피탈');
const receiverName = arg('--receiver-name', supplier === '우리캐피탈' ? '우리캐피탈렌터카' : '');
const receiverBizNo = arg('--receiver-biz-no', supplier === '우리캐피탈' ? '142-81-15688' : '');
const inputPath = resolve(arg('--input', 'docs/ui/mockups/f04.ssot.js'));
const outputDir = resolve(arg('--out', `output/settlement/${month || '미지정'}`));
const htmlDir = resolve(arg('--html-out', 'tmp/pdfs/monthly-settlement'));
if (!month) throw new Error('--month YYYY-MM가 필요합니다');
if (!receiverName || !/^\d{3}-?\d{2}-?\d{5}$/.test(receiverBizNo)) throw new Error(`${supplier}: 거래처명과 사업자등록번호가 없어 HOLD입니다(--receiver-name, --receiver-biz-no)`);

const source = readFileSync(inputPath, 'utf8');
const match = /const F04 = ([\s\S]+);\s*$/.exec(source);
if (!match) throw new Error('F04 스냅샷 형식이 아닙니다');
const f04 = JSON.parse(match[1]) as { rows?: SheetSettlementRow[]; clawbacks?: SheetClawbackRow[]; report?: { readAt?: string; title?: string; balanced?: boolean } };
if (!Array.isArray(f04.rows)) throw new Error('F04 rows가 없습니다');
if (f04.report?.title !== '[F04 사용중] 프리패스 정산원장') throw new Error('정산 시트 정본 제목이 일치하지 않습니다');
if (f04.report?.balanced !== true) throw new Error('F04 읽은 줄 = 실은 줄 + 보류한 줄 검증이 통과하지 않았습니다');
const readAt = Date.parse(f04.report.readAt ?? '');
if (!Number.isFinite(readAt)) throw new Error('F04 스냅샷 읽은 시각이 없습니다');
const ageHours = (Date.now() - readAt) / 3_600_000;
if (ageHours < -1 || ageHours > 24) throw new Error(`F04 스냅샷이 최신이 아닙니다(${ageHours.toFixed(1)}시간) — 시트를 다시 읽은 뒤 발행하세요`);

const invoice = buildMonthlyInvoice({
  month, supplier, rows:f04.rows, clawbacks:f04.clawbacks,
  issuer:{ name:'프리패스모빌리티 주식회사', bizNo:'528-88-02988', ceo:'박영협', address:'서울시 강서구 양천로 53길 30, 서서울모터리움 1004호', bank:'신한은행', account:'140-014-462206', holder:'프리패스모빌리티 주식회사', manager:'프리패스 매니저', phone:'010-6393-0926', email:'pyh@teamjpk.com', fax:'0504-202-0926' },
  receiver:{ name:receiverName, bizNo:receiverBizNo },
});

mkdirSync(outputDir, { recursive:true });
mkdirSync(htmlDir, { recursive:true });
const base = `${supplier}_${month.replace('-', '년')}월_영업수수료_정산서`;
const htmlPath = resolve(htmlDir, `${base}.html`);
const pdfPath = resolve(outputDir, `${base}.pdf`);
writeFileSync(htmlPath, monthlyInvoiceHtml(invoice), 'utf8');

const executablePath = process.env.SETTLEMENT_CHROMIUM_EXECUTABLE_PATH || await chromium.executablePath();
const browser = await puppeteer.launch({ executablePath, args:chromium.args, headless:'shell' });
try {
  const page = await browser.newPage();
  await page.goto(new URL(`file:///${htmlPath.replaceAll('\\', '/')}`).href, { waitUntil:'networkidle0' });
  await page.emulateMediaType('print');
  await page.pdf({ path:pdfPath, format:'A4', printBackground:true, margin:{ top:0, right:0, bottom:0, left:0 } });
} finally { await browser.close(); }
const bytes = readFileSync(pdfPath);
if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-' || !bytes.subarray(-4096).toString('latin1').includes('%%EOF')) throw new Error('완전한 PDF가 생성되지 않았습니다');
console.log(JSON.stringify({ status:'READY', source:{ path:inputPath, readAt:f04.report?.readAt, title:f04.report?.title }, month, supplier, rows:invoice.lines.length, supply:invoice.supply, vat:invoice.vat, total:invoice.total, pdf:pdfPath }, null, 2));
