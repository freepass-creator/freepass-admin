import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const base = process.env.PREVIEW_BASE_URL || 'http://localhost:4317';
const out = process.env.PREVIEW_CAPTURE_DIR || 'C:/dev/ai-ops/state';
const prefix = process.env.PREVIEW_CAPTURE_PREFIX || '캡처C1020-426c822b';
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.ESIGN_CHROMIUM_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const evidence: unknown[] = [];
try {
  const page = await browser.newPage();
  // Optional cookie jar obtained by authenticated `vercel curl`, never logged or committed.
  if (process.env.PREVIEW_COOKIE_JAR) {
    const jar = await readFile(process.env.PREVIEW_COOKIE_JAR, 'utf8');
    const cookies = jar.split('\n').filter(line => line.trim() && (!line.startsWith('#') || line.startsWith('#HttpOnly_'))).map(line => {
      const [domain, , cookiePath, secure, , name, value] = line.replace(/^#HttpOnly_/, '').trim().split('\t');
      return { domain, path: cookiePath, secure: secure === 'TRUE', name, value };
    });
    await browser.setCookie(...cookies);
  }
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  for (const width of [1440, 1280, 390]) {
    await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
    const response = await page.goto(base + '/preview/credit-consent', { waitUntil: 'networkidle0' });
    assert.equal(response?.status(), 200);
    await page.evaluate('document.fonts.ready');
    const state = await page.evaluate(`(() => ({
      width: innerWidth, contentWidth: document.documentElement.scrollWidth,
      checked: document.querySelectorAll('input:checked').length,
      choices: document.querySelectorAll('input[type=radio]').length,
      enabledInputs: document.querySelectorAll('input:enabled,textarea:enabled,canvas').length,
      disabledSubmit: document.querySelector('button')?.disabled,
      forms: document.querySelectorAll('form').length,
      text: document.querySelector('article')?.textContent
    }))()` ) as { width: number; contentWidth: number; checked: number; choices: number; enabledInputs: number; disabledSubmit: boolean; forms: number; text: string };
    assert.ok(state.contentWidth <= width, 'horizontal overflow');
    assert.equal(state.checked, 0); assert.equal(state.choices, 6);
    assert.equal(state.enabledInputs, 0); assert.equal(state.disabledSubmit, true); assert.equal(state.forms, 0);
    assert.match(state.text, /NICE/); assert.match(state.text, /미확정/); assert.match(state.text, /처리정지/);
    const screenshot = path.join(out, `${prefix}-${width}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    evidence.push({ viewport: width, screenshot, ...state, text: undefined });
  }
  // A4 minus the CSS @page 10mm margins: about 718 x 1047 CSS pixels.
  await page.setViewport({ width: 718, height: 1047, deviceScaleFactor: 1 });
  await page.emulateMediaType('print');
  const height = await page.$eval('article', element => element.getBoundingClientRect().height);
  assert.ok(height <= 1047, `A4 printable height exceeded: ${height}`);
  await page.screenshot({ path: path.join(out, `${prefix}-one-page.png`), fullPage: true });
  evidence.push({ printDocumentHeight: height, printableHeight: 1047 });
  const pdfPath = path.join(out, `${prefix}-draft.pdf`);
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  // Local QA dependencies: Python pypdf + pymupdf. Validate the actual paginated artifact.
  const pdfCheck = execFileSync('python', ['-c', [
    'import sys,json,fitz',
    'from pypdf import PdfReader',
    'r=PdfReader(sys.argv[1])',
    'assert len(r.pages)==1, "Expected exactly one A4 page"',
    'p=r.pages[0]; w=float(p.mediabox.width); h=float(p.mediabox.height)',
    'assert abs(w-595.28)<2 and abs(h-841.89)<2',
    't="".join(p.extract_text().split())',
    'assert "CREDIT_INQUIRY_CONSENT" in t and "draft-2026-10-21" in t',
    'd=fitz.open(sys.argv[1]); d[0].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(sys.argv[2])',
    'print(json.dumps({"pages":len(r.pages),"widthPt":w,"heightPt":h}))',
  ].join('\n'), pdfPath, path.join(out, `${prefix}-one-page.png`)], { encoding: 'utf8', windowsHide: true });
  evidence.push({ pdf: pdfPath, ...JSON.parse(pdfCheck) });
  const statuses = await page.evaluate(`(async () => {
    const draftPost = await fetch('/preview/credit-consent', {method:'POST'});
    const sign = await fetch('/sign/review-only-example');
    const signApi = await fetch('/api/esign/public/review-only-example', {method:'POST'});
    return {draftPost:draftPost.status,sign:sign.status,signApi:signApi.status};
  })()`);
  assert.deepEqual(statuses, { draftPost: 405, sign: 404, signApi: 404 });
  assert.equal(errors.length, 0, errors.join('\n'));
  evidence.push(statuses);
  const receipt = { base, checkedAt: new Date().toISOString(), evidence, errors };
  await writeFile(path.join(out, `${prefix}-qa.json`), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} finally { await browser.close(); }
