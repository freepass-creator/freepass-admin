import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const requireTool = createRequire(path.resolve(process.env.UI_BROWSER_TOOLS ?? '.', 'package.json'));
const { chromium } = requireTool('playwright');
const out = path.resolve('artifacts/next-runtime');
await mkdir(out, { recursive: true });

const port = 3217;
const origin = `http://127.0.0.1:${port}`;
const secret = 'freepass-admin-runtime-smoke-secret-2026-09-25';
const ALLOWED_EXTERNAL_PREFIXES = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/',
];
const domain = 'runtime.invalid';
const childEnv = { ...process.env,
  SESSION_SECRET: secret,
  GOOGLE_WORKSPACE_DOMAIN: domain,
  ERP5_WRITE: 'off',
};
for (const key of [
  'ERP5_FIREBASE_SERVICE_ACCOUNT_JSON','ERP5_SERVICE_ACCOUNT_PATH',
  'AUTH_FIREBASE_SERVICE_ACCOUNT_JSON','AUTH_SERVICE_ACCOUNT_PATH',
  'FIREBASE_WEB_API_KEY','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET',
  'ADMIN_EMAILS','ADMIN_UIDS','PUBLIC_BASE_URL','NEXT_PUBLIC_APP_URL','ERP5_STORAGE_BUCKET',
]) delete childEnv[key];

const lines = [];
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: process.cwd(), env: childEnv, stdio: ['ignore','pipe','pipe'],
});
server.stdout.on('data', b => lines.push('[stdout] ' + b.toString()));
server.stderr.on('data', b => lines.push('[stderr] ' + b.toString()));

const waitReady = async () => {
  const until = Date.now() + 20_000;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error('next start exited early: ' + server.exitCode);
    try {
      const r = await fetch(origin + '/login', { redirect: 'manual' });
      if (r.status >= 200 && r.status < 500) return;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('next start readiness timeout');
};

const token = () => {
  const payload = {
    uid: 'google:runtime-smoke',
    email: `runtime@${domain}`,
    name: 'Runtime Smoke',
    exp: Date.now() + 15 * 60_000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', Buffer.from(secret)).update(`g1.${body}`).digest('base64url');
  return `g1.${body}.${sig}`;
};

const receipt = {
  scope: 'ACTUAL_NEXT_PRODUCTION_RUNTIME_NO_DATA',
  head: process.env.UI_BROWSER_HEAD_SHA ?? null,
  checkout: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  data: 'no production credentials; no Firestore/IAM access; ERP5_WRITE=off; synthetic signed Google-session cookie only',
  browser: '', checks: [], routeChecks: [], externalRequests: [], serverLog: 'server.log',
};
const check = (name, ok, detail='') => {
  receipt.checks.push({ name, ok:Boolean(ok), ...(detail ? {detail} : {}) });
  if (!ok) console.error('RUNTIME_FAIL', name, detail);
  else console.log('RUNTIME_PASS', name);
};

let browser;
try {
  await waitReady();
  browser = await chromium.launch({ headless: true });
  receipt.browser = browser.version();

  // 1. Real production auth/proxy boundary, no cookie.
  const anon = await browser.newContext({ viewport:{width:390,height:844}, locale:'ko-KR', reducedMotion:'reduce' });
  await anon.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(origin + '/') || u.startsWith('data:')) return route.continue();
    receipt.externalRequests.push(u.split('?')[0]); return route.abort();
  });
  const login = await anon.newPage();
  const pageErrors = [];
  login.on('pageerror', e => pageErrors.push(e.message));
  await login.goto(origin + '/products?q=sample', { waitUntil:'networkidle' });
  const redirected = new URL(login.url());
  check('unauthenticated GET redirects to login', redirected.pathname === '/login');
  check('login redirect preserves exact protected destination', redirected.searchParams.get('next') === '/products?q=sample', redirected.search);
  check('real login UI rendered', await login.getByRole('heading',{name:'로그인'}).count() === 1);
  const hiddenNext = await login.locator('input[name="next"]').getAttribute('value');
  check('login form carries redirect destination', hiddenNext === '/products?q=sample', String(hiddenNext));
  await login.screenshot({path:path.join(out,'390-login-redirect.png'),fullPage:true});

  const post = await anon.request.post(origin + '/settlement', {
    headers:{'content-type':'application/json'}, data:{test:true}, maxRedirects:0,
  });
  check('unauthenticated POST is fail-closed 401', post.status() === 401, String(post.status()));
  const postBody = await post.json().catch(()=>null);
  check('unauthenticated POST returns generic login error', postBody?.error === '로그인이 필요합니다');

  const api = await anon.request.get(origin + '/api/esign/asset/not-real/not-real', { maxRedirects:0 });
  check('unauthenticated private API is fail-closed 401', api.status() === 401, String(api.status()));
  check('unauthenticated browser has no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  await anon.close();

  // 2. Auth boundary crossed with a synthetic cookie that follows the real g1 session format.
  // No ERP5 credentials are supplied, so protected routes must reach their real route error boundary safely.
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport:{width,height:900}, locale:'ko-KR', reducedMotion:'reduce' });
    await ctx.addCookies([{ name:'fpa_session', value:token(), url:origin, httpOnly:true, sameSite:'Lax' }]);
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(origin + '/') || u.startsWith('data:')) return route.continue();
      const external = u.split('?')[0];
      if (ALLOWED_EXTERNAL_PREFIXES.some((prefix) => external.startsWith(prefix))) return route.continue();
      receipt.externalRequests.push(external); return route.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // 전자계약은 운영 개시 범위 밖(DEC-2026-09-25-05) — ESIGN_ENABLED 미설정이면 목록은 접수로, 고객 링크·API 는 404.
    await page.goto(origin + '/esign', { waitUntil:'networkidle' });
    check(`${width}px /esign is closed and redirects to intake`, new URL(page.url()).pathname === '/intake', page.url());
    const signLink = await ctx.request.get(origin + '/sign/not-real', { maxRedirects:0 });
    check(`${width}px authenticated customer sign link is closed 404`, signLink.status() === 404, String(signLink.status()));
    const esignApi = await ctx.request.get(origin + '/api/esign/asset/not-real/not-real', { maxRedirects:0 });
    check(`${width}px authenticated esign API is closed 404`, esignApi.status() === 404, String(esignApi.status()));

    for (const [route, title] of [['/products','상품찾기'],['/intake','계약접수'],['/settlement','정산관리']]) {
      await page.goto(origin + route, { waitUntil:'networkidle' });
      const body = await page.locator('body').innerText();
      const ok = page.url().startsWith(origin + route)
        && body.includes(title)
        && body.includes('데이터를 불러오지 못했습니다.')
        && body.includes('다시 시도');
      const leaked = /ERP5_FIREBASE_SERVICE_ACCOUNT_JSON|ERP5_SERVICE_ACCOUNT_PATH|private_key|자격증명이 없다/.test(body);
      receipt.routeChecks.push({width,route,ok,rawCredentialLeak:leaked});
      check(`${width}px ${route} reaches user-safe route error boundary`, ok);
      check(`${width}px ${route} does not expose credential diagnostics`, !leaked);

      if (route === '/products') {
        let localRequests = 0;
        const observe = req => { if (req.url().startsWith(origin + route)) localRequests++; };
        page.on('request', observe);
        await page.getByRole('button',{name:'다시 시도'}).click();
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(250);
        page.removeListener('request', observe);
        check(`${width}px retry keeps fail-closed error state`, await page.getByText('데이터를 불러오지 못했습니다.').isVisible());
        check(`${width}px retry performs a real Next request`, localRequests > 0, `requests=${localRequests}`);
        await page.screenshot({path:path.join(out,`${width}-products-error-retry.png`),fullPage:true});
      }
    }

    await page.goto(origin + '/', { waitUntil:'networkidle' });
    check(`${width}px authenticated root redirects to canonical intake route`, new URL(page.url()).pathname === '/intake', page.url());
    check(`${width}px redirected intake still fails closed without ERP5 credentials`,
      await page.getByText('데이터를 불러오지 못했습니다.').isVisible());
    await page.screenshot({path:path.join(out,`${width}-root-intake-error.png`),fullPage:true});
    check(`${width}px authenticated runtime has no client page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  check('browser emitted no unexpected external requests', receipt.externalRequests.length === 0, receipt.externalRequests.join(' | '));
} catch (e) {
  receipt.fatal = String(e?.stack ?? e);
  console.error(receipt.fatal);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await new Promise(resolve => {
    if (server.exitCode !== null) return resolve();
    const t=setTimeout(resolve,3000);
    server.once('exit',()=>{clearTimeout(t);resolve();});
  });
  await writeFile(path.join(out,'server.log'), lines.join(''));
  receipt.failed = Boolean(receipt.fatal)
    || receipt.checks.some(x => !x.ok)
    || receipt.routeChecks.some(x => !x.ok || x.rawCredentialLeak);
  await writeFile(path.join(out,'receipt.json'), JSON.stringify(receipt,null,2)+'\n');
  console.log('NEXT_RUNTIME_RECEIPT '+JSON.stringify(receipt));
  if (receipt.failed) process.exitCode = 1;
}
