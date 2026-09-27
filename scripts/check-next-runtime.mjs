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
/* 외부 요청은 하나도 허용하지 않는다 — 글꼴도 Firebase SDK 도 우리가 서비스한다(2026-09-27) */
const ALLOWED_EXTERNAL_PREFIXES = [];
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
  'IDENTITY_FIREBASE_WEB_API_KEY','IDENTITY_FIREBASE_AUTH_DOMAIN','IDENTITY_FIREBASE_PROJECT_ID',
  'IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON',
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
  /* 문이 «서 있는지»를 본다. 로그인 화면은 프리패스 공용 화면(src/app/login/shared/)이고,
     Firebase 웹 설정은 배포 때 들어오는 값이라 CI 에는 없다.
     ★없을 때 «없는 것을 통과시키지 않는다» — 까닭을 적고 «다른 문을 내주지 않았는지»를 대신 검사한다.
       설정이 없다고 빈 화면이 서거나 딴 입구가 열리면 그게 사고다. */
  const configured = await login.locator('.fpl-card').count();
  if (configured) {
    check('shared login screen is mounted', configured === 1);
    check('shared login screen offers the approval-mode join', await login.getByText('가입').count() > 0);
  } else {
    const closed = await login.getByText('로그인 설정이 아직 없습니다').count();
    const fields = await login.locator('input[type="password"], input[type="email"]').count();
    const otherDoor = await login.locator('a[href*="/login/"]').count();
    check('login door absent: says why and offers no other way in',
      closed === 1 && fields === 0 && otherDoor === 0, `notice=${closed} fields=${fields} doors=${otherDoor}`);
  }
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

  /* 2. 위조된 세션은 어디서도 거부된다.
     ★예전에는 여기서 g1 꼴의 쿠키를 직접 만들어 «로그인한 » 길을 걸어보았다.
       이제 세션은 Firebase 가 발급하므로 우리가 만들 수 없다 — 만들 수 있으면 그게 사고다.
       그래서 «지나가는지» 대신 «막히는지» 를 검사한다.
     ⚠ 남은 구멍: 로그인한 다음의 route error boundary·재시도 검사는 이제 여기서 못 돌린다.
       되살리려면 Firebase Auth 에뮬레이터가 필요하며, 그것은 별도 작업이다. */
  receipt.coverageGaps = ['authenticated route error boundary and retry need a Firebase Auth emulator'];
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

    for (const route of ['/products', '/intake', '/settlement']) {
      await page.goto(origin + route, { waitUntil:'networkidle' });
      const landed = new URL(page.url()).pathname;
      const body = await page.locator('body').innerText();
      const leaked = /ERP5_FIREBASE_SERVICE_ACCOUNT_JSON|IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON|private_key|자격증명이 없다/.test(body);
      /* ★`ok` 를 빼면 영수증의 failed 계산(`routeChecks.some(x => !x.ok)`)이 undefined 를 보고
         «전부 통과했는데 실패» 가 된다. 인쇄된 결과와 종료 코드가 어긋나면 둘 다 못 믿는다. */
      receipt.routeChecks.push({width,route,landed,ok:landed === '/login',rawCredentialLeak:leaked});
      check(`${width}px forged session cannot open ${route}`, landed === '/login', landed);
      check(`${width}px ${route} does not expose credential diagnostics`, !leaked);
    }

    /* 위조된 세션의 쓰기는 «거부»되어야 한다. 꼴만 보는 proxy 를 지나가므로
       거부하는 자리가 바뀜다 — 서버 액션은 requireAdmin 이, 그상 POST 는 쪽의 문이 막는다.
       그래서 답이 401 일 수도, 로그인으로 돌려보내는 307 일 수도 있다.
       ★가를 것은 «열렸는가»이다 — 2xx 가 나오면 사고고, 돌려보낸다면 로그인이어야 한다. */
    const post = await ctx.request.post(origin + '/settlement', {
      headers:{'content-type':'application/json'}, data:{test:true}, maxRedirects:0,
    });
    const status = post.status();
    const sentTo = status >= 300 && status < 400 ? new URL(post.headers()['location'] ?? '/', origin).pathname : null;
    const refused = status >= 400 || (status >= 300 && status < 400 && sentTo === '/login');
    check(`${width}px forged session cannot write`, refused, `${status}${sentTo ? ' -> ' + sentTo : ''}`);
    const esignApi = await ctx.request.get(origin + '/api/esign/asset/not-real/not-real', { maxRedirects:0 });
    check(`${width}px forged session cannot reach the private esign API`,
      esignApi.status() === 401 || esignApi.status() === 404, String(esignApi.status()));
    const signLink = await ctx.request.get(origin + '/sign/not-real', { maxRedirects:0 });
    check(`${width}px customer sign link stays closed 404`, signLink.status() === 404, String(signLink.status()));

    await page.screenshot({path:path.join(out,`${width}-forged-session-refused.png`),fullPage:true});
    check(`${width}px runtime has no client page errors`, errors.length === 0, errors.join(' | '));
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
