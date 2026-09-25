import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Install browser tools outside the application dependency tree; see the workflow.
const requireTool = createRequire(path.resolve(process.env.UI_BROWSER_TOOLS ?? '.', 'package.json'));
const { chromium } = requireTool('playwright');
const { build } = requireTool('esbuild');
const root = process.cwd();
const out = path.join(root, 'artifacts/ui-browser');
await mkdir(out, { recursive: true });
const sources = ['src/app/globals.css', 'src/app/_design/admin-final.css',
  'src/app/_design/ListRow.tsx', 'src/app/_design/OfferPicker.tsx',
  'src/app/_design/DetailTabs.tsx', 'src/app/_design/Primitives.tsx',
  'scripts/browser/fixture.tsx', 'scripts/check-ui-browser.mjs'];
const hashes = {};
for (const file of sources) hashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const css = await readFile(sources[0], 'utf8') + '\n' + await readFile(sources[1], 'utf8');
const bundle = await build({
  entryPoints: ['scripts/browser/fixture.tsx'], bundle: true, write: false,
  platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  // Test boundary only: retain anchor markup without Next router/prefetch requests.
  plugins: [{ name: 'navigation-test-boundary', setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'test-nav' }));
    b.onLoad({ filter: /.*/, namespace: 'test-nav' }, () => ({ loader: 'tsx', resolveDir: root,
      contents: `import {forwardRef} from 'react'; export default forwardRef(function TestLink({href,prefetch,replace,scroll,shallow,locale,...props},ref){return <a ref={ref} href={typeof href==='string'?href:'#test-only'} {...props}/>;});` }));
  } }],
});
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FreePass Admin component verification</title><link rel="stylesheet" href="/ui.css"></head><body><main class="fn-main" id="root"></main><script src="/fixture.js"></script></body></html>';
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/ui.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else if (pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); }
    else if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); }
    else if (/\.(woff2?|ttf|otf)$/.test(pathname)) {
      const publicRoot = path.resolve(root, 'public');
      const file = path.resolve(publicRoot, '.' + decodeURIComponent(pathname));
      if (!file.startsWith(publicRoot + path.sep)) throw new Error('Invalid font path');
      res.end(await readFile(file));
    } else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); }
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const receipt = { scope: 'ISOLATED_COMPONENT_BROWSER',
  excludes: ['production deployment', 'Firestore/IAM', 'real authentication', 'Next routing', 'mobile soft keyboard', 'RTL', 'FilterSheet'],
  data: 'synthetic-only; no credentials; external requests blocked',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sources: hashes, browser: '', cases: [], interactions: [], externalRequests: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true });
  receipt.browser = browser.version();
  for (const width of [320, 360, 390, 412, 901, 1024, 1280, 1440]) {
    for (const view of ['list', 'detail', 'work']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR', reducedMotion: 'reduce' });
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origin + '/') || url.startsWith('data:')) return route.continue();
        receipt.externalRequests.push(url.split('?')[0]);
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/?view=${view}`, { waitUntil: 'networkidle' });
      await page.locator('.workspace').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(({ width, view }) => {
        const failures = [];
        const visible = el => el.getClientRects().length > 0;
        const check = (ok, message) => { if (!ok) failures.push(message); };
        const doc = document.documentElement;
        check(doc.scrollWidth <= doc.clientWidth + 1, `page overflow: ${doc.scrollWidth} > ${doc.clientWidth}`);
        for (const panel of document.querySelectorAll('.panel')) if (visible(panel)) {
          check(panel.scrollWidth <= panel.clientWidth + 1, `${panel.className} overflow: ${panel.scrollWidth} > ${panel.clientWidth}`);
        }
        for (const row of document.querySelectorAll('.dz-row-l2.value')) if (visible(row)) {
          const r = row.getBoundingClientRect();
          const segments = [...row.querySelectorAll('.dz-seg')].map(el => el.getBoundingClientRect());
          for (const s of segments) check(s.left >= r.left - 1 && s.right <= r.right + 1, 'product value outside row');
          for (let i=0;i<segments.length;i++) for (let j=i+1;j<segments.length;j++) {
            const a=segments[i], b=segments[j];
            check(Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1, 'product values overlap');
          }
        }
        for (const el of document.querySelectorAll('.dz-offer-rent, .dz-offer-conditions')) if (visible(el)) {
          check(el.scrollWidth <= el.clientWidth + 1, `${el.className} clipped: ${el.scrollWidth} > ${el.clientWidth}`);
        }
        for (const bar of document.querySelectorAll('.dz-bar-go')) if (visible(bar)) {
          const buttons = [...bar.children].filter(visible);
          for (const b of buttons) check(b.getBoundingClientRect().height >= 43.5, 'ActionBar target below 44px');
          const expected = buttons.length===2?[3,7]:buttons.length===3?[3,3,4]:null;
          if (expected) {
            const sizes=buttons.map(el=>el.getBoundingClientRect().width), total=sizes.reduce((a,b)=>a+b,0);
            check(sizes.every((n,i)=>Math.abs(n/total-expected[i]/10)<0.015), `ActionBar ratio ${sizes.join('/')}`);
          }
        }
        if (width === 320 && view === 'work') {
          const grid = document.querySelector('.dz-picked-grid');
          const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean);
          check(columns.length === 1, `320px picked summary must have 1 column, got ${columns.length}`);
        }
        return { failures, pageWidth: doc.clientWidth, scrollWidth: doc.scrollWidth };
      }, { width, view });
      result.failures.push(...errors.map(e => `pageerror: ${e}`));
      const name = `${width}-${view}`;
      await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
      receipt.cases.push({ name, ...result });
      console.log(`UI_BROWSER_CASE ${name}: ${result.failures.length ? 'FAIL '+result.failures.join('; ') : 'PASS'}`);
      if (view === 'detail' && [390, 1440].includes(width)) {
        const checks = [];
        const tabs = page.getByRole('tab');
        await tabs.nth(0).focus();
        await page.keyboard.press('ArrowRight');
        checks.push(['right selects detail', await tabs.nth(1).getAttribute('aria-selected') === 'true']);
        await page.keyboard.press('ArrowRight');
        checks.push(['right wraps to summary', await tabs.nth(0).getAttribute('aria-selected') === 'true']);
        await page.keyboard.press('End');
        checks.push(['End selects detail', await tabs.nth(1).getAttribute('aria-selected') === 'true']);
        await page.keyboard.press('Home');
        checks.push(['Home selects summary', await tabs.nth(0).getAttribute('aria-selected') === 'true']);
        await page.locator('.dz-offer-rows > button').nth(2).click();
        checks.push(['offer changes intake link', (await page.locator('.detail-panel .primary').getAttribute('href')).endsWith('offer=test-60')]);
        checks.push(['one offer selected', await page.locator('.dz-offer-rows [aria-pressed="true"]').count() === 1]);
        await tabs.nth(1).click(); await tabs.nth(0).click();
        checks.push(['offer survives tab change', (await page.locator('.detail-panel .primary').getAttribute('href')).endsWith('offer=test-60')]);
        receipt.interactions.push({ width, checks });
      }
      await context.close();
    }
  }
} catch (error) {
  receipt.fatal = String(error.stack ?? error);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  receipt.failed = Boolean(receipt.fatal) || receipt.cases.some(c => c.failures.length) || receipt.interactions.some(c => c.checks.some(([,ok]) => !ok));
  await writeFile(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log('UI_BROWSER_RECEIPT ' + JSON.stringify(receipt));
  if (receipt.failed) process.exitCode = 1;
}
