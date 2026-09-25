import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const requireTool = createRequire(path.resolve(process.env.UI_BROWSER_TOOLS ?? '.', 'package.json'));
const { chromium } = requireTool('playwright');
const { build } = requireTool('esbuild');
const out = path.resolve('artifacts/ui-filter-browser');
await mkdir(out, { recursive: true });
const layout = await readFile('src/app/layout.tsx', 'utf8');
const styles = [...layout.matchAll(/import\s+['"](\.\/[^'"]+\.css)['"]/g)].map(([, p]) => path.posix.join('src/app', p));
if (!styles.length) throw new Error('Missing production CSS order');
const sources = [...styles, 'src/app/layout.tsx', 'src/app/_design/FilterSheet.tsx', 'src/app/_design/pick.ts',
  'scripts/browser/filter-fixture.tsx', 'scripts/browser/filter-navigation.ts', 'scripts/check-ui-filter-browser.mjs'];
const hashes = {};
for (const file of sources) {
  const bytes = await readFile(file);
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
  const copy = path.join(out, 'source', file); await mkdir(path.dirname(copy), { recursive: true }); await writeFile(copy, bytes);
}
const css = (await Promise.all(styles.map(p => readFile(p, 'utf8')))).join('\n');
const bundle = await build({ entryPoints: ['scripts/browser/filter-fixture.tsx'], bundle: true, write: false,
  platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'isolated-filter-navigation', setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.resolve('scripts/browser/filter-navigation.ts') }));
  } }],
});
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"><title>FilterSheet verification</title></head><body><main class="fn-main" id="root"></main><script src="/filter.js"></script></body></html>';
const server = createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://localhost').pathname;
    if (p === '/ui.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else if (p === '/filter.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); }
    else if (p === '/favicon.ico') { res.writeHead(204); res.end(); }
    else if (/\.(woff2?|ttf|otf)$/.test(p)) {
      const base=path.resolve('public'), file=path.resolve(base, '.'+decodeURIComponent(p));
      if (!file.startsWith(base+path.sep)) throw new Error('invalid font path');
      res.end(await readFile(file));
    } else { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html); }
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const receipt={ scope:'ISOLATED_FILTER_COMPONENT_BROWSER',
  excludes:['Next server navigation/pending races','Firestore/IAM','production login','physical soft keyboard','real browser zoom','RTL'],
  data:'synthetic only; no credentials; nonlocal requests blocked',
  head:process.env.UI_BROWSER_HEAD_SHA ?? null,
  checkout:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), sources:hashes, styles,
  cases:[], externalRequests:[] };
let browser;
try {
  browser=await chromium.launch({headless:true}); receipt.browser=browser.version();
  for (const width of [320,390,900,901,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'});
    await context.route('**/*', route => {
      const u=route.request().url(); if(u.startsWith(origin+'/') || u.startsWith('data:')) return route.continue();
      receipt.externalRequests.push(u.split('?')[0]); return route.abort();
    });
    const page=await context.newPage(); page.setDefaultTimeout(5000);
    const checks=[], errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const frames=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const check=async(name,fn)=>{let ok=false,why;try{ok=Boolean(await fn());}catch(e){why=String(e.message);}checks.push({name,ok,...(why?{why}:{})});};
    const focusedInside=()=>page.evaluate(()=>Boolean(document.querySelector('.dz-fs-sheet')?.contains(document.activeElement)));
    const open=async()=>{await page.locator('.dz-fs-open').click();await page.getByRole('dialog').waitFor();await frames();};
    const fresh=async(extra='')=>{await page.goto(`${origin}/?q=sample&keep=yes&page=4${extra}`,{waitUntil:'networkidle'});await open();};
    const selected=async(key)=>new URL(page.url()).searchParams.get(key);
    await fresh();
    await check('opens with focus inside',focusedInside);
    await check('modal matches viewport',async()=>await page.getByRole('dialog').getAttribute('aria-modal')===(width<=900?'true':null));
    await check('empty axis omitted',async()=>await page.getByRole('button',{name:'빈 항목',exact:true}).count()===0);
    await check('dialog fits viewport',()=>page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1 && el.scrollWidth<=el.clientWidth+1;}));
    await page.screenshot({path:path.join(out,`${width}-open.png`),fullPage:true});
    await page.locator('.dz-fs-more').click();await frames();
    await check('more focuses first newly revealed option',()=>page.evaluate(()=>document.activeElement?.textContent?.includes('시험 상태 9')));
    await page.getByRole('button',{name:/^출고불가/}).click();await frames();
    await check('zero-count option remains selectable',async()=>await selected('status')==='blocked');
    await check('result button shows zero',async()=>await page.locator('.dz-fs-foot .primary').innerText()==='0대 보기');
    await check('query preserved and page reset',async()=>{const u=new URL(page.url());return u.searchParams.get('keep')==='yes' && u.searchParams.get('q')==='sample' && !u.searchParams.has('page');});
    await page.getByRole('button',{name:'해제',exact:true}).click();await frames();
    await check('axis clear removes only selected axis',async()=>await selected('status')===null);
    await check('axis clear keeps meaningful focus',focusedInside);
    await page.getByRole('button',{name:/^즉시출고/}).click();await frames();
    await page.getByRole('button',{name:'상품구분',exact:true}).click();
    await page.getByRole('button',{name:/^신차렌트/}).click();await frames();
    await page.getByRole('button',{name:'해제',exact:true}).click();await frames();
    await check('clear one axis preserves other axis',async()=>await selected('status')==='ready' && await selected('kind')===null);
    await page.getByRole('button',{name:'초기화',exact:true}).click();await frames();
    await check('reset preserves unrelated query',async()=>await selected('status')===null && await selected('kind')===null && await selected('keep')==='yes');
    await check('reset keeps meaningful focus',focusedInside);
    await page.keyboard.press('Escape');await frames();
    await check('Escape closes and restores trigger',()=>page.evaluate(()=>!document.querySelector('.dz-fs-sheet') && document.activeElement===document.querySelector('.dz-fs-open')));
    await open();
    if(width<=900){
      await page.getByRole('button',{name:'닫기',exact:true}).focus();await page.keyboard.press('Shift+Tab');await frames();
      await check('Shift Tab wraps to last control',()=>page.evaluate(()=>document.activeElement===document.querySelector('.dz-fs-foot .primary')));
      await page.keyboard.press('Tab');await frames();
      await check('Tab wraps to first control',()=>page.evaluate(()=>document.activeElement?.getAttribute('aria-label')==='닫기'));
      await page.locator('#outside').evaluate(el=>el.focus());await frames();
      await check('mobile background cannot take focus',focusedInside);
      await check('mobile background is inert',()=>page.locator('#outside').evaluate(el=>Boolean(el.closest('[inert]'))));
      await check('mobile document scroll is locked',()=>page.evaluate(()=>getComputedStyle(document.documentElement).overflowY==='hidden' && getComputedStyle(document.body).overflowY==='hidden'));
      // Recover focus even on the known-bad baseline so the remaining cases run.
      await page.getByRole('button',{name:'닫기',exact:true}).focus();
      await page.keyboard.press('Escape');await frames();
      await check('closing releases background and scroll',()=>page.locator('#outside').evaluate(el=>!el.closest('[inert]') && document.documentElement.style.overflow!=='hidden' && document.body.style.overflow!=='hidden'));
      await open();await page.setViewportSize({width:1440,height:900});await frames();
      await check('resize to desktop removes modality',async()=>await page.getByRole('dialog').getAttribute('aria-modal')===null && await page.locator('#outside').evaluate(el=>!el.closest('[inert]')));
    }
    await page.locator('#outside').click();await frames();
    await check('desktop outside click preserves target focus',()=>page.locator('#outside').evaluate(el=>document.activeElement===el));
    await page.keyboard.type('continued');
    await check('typing continues in outside input',async()=>await page.locator('#outside').inputValue()==='continued');
    await page.setViewportSize({width,height:900});
    await fresh('&status=s10');
    await check('selected hidden option expands automatically',async()=>await page.getByRole('button',{name:/^시험 상태 10/}).getAttribute('aria-pressed')==='true');
    await page.getByRole('button',{name:'닫기',exact:true}).click();await frames();
    await check('close button restores trigger',()=>page.evaluate(()=>document.activeElement===document.querySelector('.dz-fs-open')));
    await fresh('&empty=1');
    await check('empty axes still allow safe close',async()=>await page.getByRole('button',{name:'닫기',exact:true}).isVisible());
    await page.keyboard.press('Escape');await frames();
    await check('empty axes close leaves background usable',()=>page.locator('#outside').evaluate(el=>!el.closest('[inert]')));
    await check('no runtime errors',()=>errors.length===0);
    receipt.cases.push({width,checks,errors});
    console.log(`FILTER_BROWSER ${width}: ${checks.filter(x=>x.ok).length}/${checks.length}; FAIL=${checks.filter(x=>!x.ok).map(x=>x.name).join(' | ')}`);
    await context.close();
  }
}catch(e){receipt.fatal=String(e.stack??e);}
finally{
  if(browser)await browser.close();await new Promise(r=>server.close(r));
  receipt.failed=Boolean(receipt.fatal)||receipt.cases.length!==5||receipt.cases.some(c=>c.checks.some(x=>!x.ok));
  await writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log('FILTER_BROWSER_RECEIPT '+JSON.stringify(receipt));
  if(receipt.failed)process.exitCode=1;
}
