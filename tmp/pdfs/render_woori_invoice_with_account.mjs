import { chromium } from 'file:///C:/dev/freepasserp4/node_modules/playwright/index.mjs';
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const html = 'C:/Users/admin/.codex/worktrees/woori-invoice-account/freepass-admin/output/pdf/우리캐피탈_2026년09월_청구서_계좌반영.pdf.html';
const pdf = html.replace(/\.html$/, '');
const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(300);
const bytes = await page.pdf({
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
const expected = (readFileSync(html, 'utf8').match(/class="doc"/g) || []).length;
const actual = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
if (actual !== expected) throw new Error(`페이지 수 불일치: HTML ${expected}, PDF ${actual}`);
writeFileSync(pdf, bytes);
console.log(pdf);
