import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8');
const root=read('src/app/page.tsx');
const designRoute=read('src/app/design/page.tsx');
const intakeListRoute=read('src/app/intake/list/page.tsx');
const chrome=read('src/app/_design/AdminChrome.tsx');
const workspace=read('src/app/products/workspace.tsx');
const intakeForm=read('src/app/intake/new/IntakeForm.tsx');
const settlementPage=read('src/app/settlement/page.tsx');
const claimDoor=read('src/app/c/[token]/ClaimDoor.tsx');
const claimLinkUi=read('src/app/settlement/LifeForms.tsx');
const intakeDetail=read('src/app/intake/IntakeDetailPanel.tsx');
const css=[read('src/app/globals.css'),read('src/app/_design/admin-final.css'),read('src/app/_design/erp-theme.css')].join('\n');

test('admin root enters the real intake workspace and contains no demo runtime',()=>{
  assert.ok(/redirect\(['"]\/intake['"]\)/.test(root));
  assert.equal(/INITIAL_APPS|const\s+PRODUCTS\s*=|demoData|fixtureData|MOCK_/.test(root),false);
});

// DEC-2026-09-23-01 — PC 는 AI Core ERP 표준 골격(왼쪽 업무 메뉴), 폰은 다섯 걸음 하단바 그대로.
test('admin chrome uses the ERP standard shell: side menu on PC, five-step tab bar on phone, no top actions',()=>{
  const side=read('src/app/_design/SideMenu.tsx');
  for (const [href,label] of [['/products','상품찾기'],['/intake','계약접수'],['/intake?iv=완납실적&wiv=실적','실적'],['/settlement','정산관리'],['/esign','전자계약']]) {
    assert.ok(side.includes(`href: '${href}'`),`side menu missing ${href}`);
    assert.ok(side.includes(label),`side menu missing ${label}`);
  }
  // 업무 차례: 상품 · 접수 · 실적 · 정산, 전자계약은 따로(대표 2026-09-23)
  const order=['상품찾기','계약접수','실적','정산관리','전자계약'].map((w)=>side.indexOf(`label: '${w}'`));
  assert.ok(order.every((i)=>i>=0),'every menu label is defined');
  assert.deepEqual([...order].sort((a,b)=>a-b),order);
  assert.ok(side.includes('erp-nav-group--apart'));
  assert.ok(chrome.includes('<SideMenu />'));
  assert.ok(chrome.includes('<MobileTabBar />'));
  assert.ok(chrome.includes('className="erp-theme-flag"'));
  assert.equal(chrome.includes('className="rail"'),false);
  // 모바일은 전역 상단바 자체를 안 둔다(2026-09-24 — 전역 상태줄 header 를 걷어내고 Panel 이 화면
  // 맨 위에서 시작한다) — 예전 폰 상단바(fn-top dz-statusbar)가 더는 없는지 확인한다.
  assert.equal(chrome.includes('fn-top dz-statusbar'),false,'모바일 전역 상단바를 다시 넣지 않는다');
  // PC 상단 정보줄에는 실행 버튼을 두지 않는다(2026-09-18) — 통합검색(erp-gsearch)은 조회라 예외.
  const top=chrome.slice(chrome.indexOf('<header'),chrome.indexOf('</header>'));
  assert.equal(/<button/.test(top),false);
  assert.ok(/max-width: 900px\)\s*\{\s*\.erp-std[^}]*display:\s*none/.test(read('src/app/_erp/shell.css')), 'phone hides the PC shell');
});

test('theme choice is limited to the registered ERP themes and never redirects off-site',async()=>{
  const { themeOf, safeBack, THEMES } = await import('./app/_design/theme');
  assert.deepEqual([...THEMES],['classic','retro']);
  assert.equal(themeOf('retro'),'retro');
  assert.equal(themeOf('neon'),'classic');
  assert.equal(themeOf(undefined),'classic');
  assert.equal(safeBack('/products?id=1'),'/products?id=1');
  for (const bad of ['//evil.example','https://evil.example','/\\evil','javascript:alert(1)','']) assert.equal(safeBack(bad),'/');
});

test('product workspace is bound to real repositories and whole-offer selection',()=>{
  assert.ok(workspace.includes('productList()'));
  assert.ok(workspace.includes('settlements.list()'));
  assert.ok(workspace.includes('<OfferPicker'));
  assert.ok(workspace.includes('<FilterSheet'));
  assert.ok(workspace.includes('quick-filters'));
  assert.ok(workspace.includes('matchedOffers'));
});

test('mobile workspace uses explicit list detail work depth',()=>{
  assert.ok(workspace.includes("['list', 'detail', 'work']"));
  assert.ok(workspace.includes('data-phone={view}'));
  assert.ok(css.includes('[data-phone='));
});

test('primary intake actions keep the shared bottom action boundary',()=>{
  assert.ok(intakeForm.includes('className="dz-bar"'));
  assert.ok(intakeForm.includes('className="dz-bar-go"'));
  assert.ok(css.includes('.dz-bar'));
  assert.ok(css.includes('--ui-action-h'));
});

test('legacy prototype and duplicate intake routes converge on canonical workspace',()=>{
  assert.ok(/redirect\(['"]\/intake['"]\)/.test(designRoute));
  assert.equal(/INITIAL_APPS|const\s+PRODUCTS\s*=|demoData|fixtureData|MOCK_/.test(designRoute),false);
  assert.ok(intakeListRoute.includes("new URLSearchParams({ v: 'work' })"));
  assert.ok(intakeListRoute.includes("u.set('iq', text)"));
  assert.ok(intakeListRoute.includes("u.set('wiq', text)"));
  assert.ok(intakeListRoute.includes("u.set('im', month)"));
  assert.ok(intakeListRoute.includes("u.set('iv', '취소')"));
  assert.ok(intakeListRoute.includes("u.set('wiv', '취소')"));
  assert.ok(intakeListRoute.includes('redirect(`/intake?${u}`)'));
});

test('settlement guidance describes live actions instead of future placeholders',()=>{
  assert.equal(settlementPage.includes('업무 규칙이 굳으면'),false);
  assert.ok(settlementPage.includes('청구서·지급명세는 가운데 묶음에서 발행'));
  assert.ok(settlementPage.includes('확인·정정·계산서·수금·지급'));
});


test('intake settlement handoff carries focus and settlement resolves it',()=>{
  assert.ok(intakeDetail.includes('focus=${encodeURIComponent(r.id)}'));
  assert.ok(settlementPage.includes('locateSettlementFocus'));
  assert.ok(settlementPage.includes("u.delete('focus')"));
});


test('settlement completed row offers next actionable work',()=>{
  assert.ok(settlementPage.includes('nextActionablePerformanceCode'));
  assert.ok(intakeDetail.includes('다음 할 일'));
  assert.ok(intakeDetail.includes('life.nextHref'));
});


test('settlement completed queue can continue to the next actionable party',()=>{
  assert.ok(settlementPage.includes('nextActionableLedgerParty'));
  assert.ok(intakeDetail.includes('다음 거래처'));
  assert.ok(intakeDetail.includes('life.nextGroupHref'));
});


test('focused settlement miss stays fail-closed and points back to intake',()=>{
  assert.ok(settlementPage.includes('focusMiss'));
  assert.ok(settlementPage.includes('접수 상세에서 막힘 확인'));
  assert.ok(settlementPage.includes('/intake?ic='));
});


test('settlement supplier flow places invoice before collection',()=>{
  assert.ok(intakeDetail.includes('settlementPrimaryAction'));
  assert.ok(intakeDetail.includes("label: '계산서 끊기'"));
  assert.ok(intakeDetail.includes('biz={life.invoiceBiz}'));
  assert.ok(settlementPage.includes('invoiceBiz: 장?.partyBizNo'));
});


test('supplier lifecycle renders invoice as an explicit step',()=>{
  assert.ok(intakeDetail.includes("['접수', '청구', '확인', '계산서', '수금']"));
  assert.ok(intakeDetail.includes("r.progress.invoiceIssued ? '수금' : '계산서'"));
});


test('settlement UI separates document progress from cash completion',()=>{
  assert.ok(settlementPage.includes("tab === 'claim' ? '청구서 보냄' : '지급 통보'"));
  assert.ok(settlementPage.includes("tab === 'claim' ? '수금 완료' : '지급 완료'"));
  assert.ok(settlementPage.includes('g.completed'));
});


test('claim rows stay active until collection completes',()=>{
  assert.ok(settlementPage.includes("tab === 'claim' ? r.progress.collected : r.progress.paid"));
});


test('claim link renders authoritative final response and lock state',()=>{
  assert.ok(claimDoor.includes('res?.ok ? res.response'));
  assert.ok(claimDoor.includes('받은답.codes?.length'));
  assert.ok(claimLinkUi.includes('사업자번호 오입력'));
  assert.ok(claimLinkUi.includes('잠김'));
  assert.ok(settlementPage.includes('locked={!!장.lockedUntil && 장.lockedUntil > Date.now()}'));
});
