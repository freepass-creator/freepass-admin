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
const intakeDetail=read('src/app/intake/IntakeDetailPanel.tsx');
const css=[read('src/app/globals.css'),read('src/app/_design/admin-final.css')].join('\n');

test('admin root enters the real intake workspace and contains no demo runtime',()=>{
  assert.ok(/redirect\(['"]\/intake['"]\)/.test(root));
  assert.equal(/INITIAL_APPS|const\s+PRODUCTS\s*=|demoData|fixtureData|MOCK_/.test(root),false);
});

test('admin chrome exposes the operational lanes without a legacy left rail',()=>{
  assert.ok(chrome.includes("['/products', '상품찾기']"));
  assert.ok(chrome.includes("['/intake', '계약접수']"));
  assert.ok(chrome.includes("['/settlement', '정산관리']"));
  assert.ok(chrome.includes('<MobileTabBar />'));
  assert.ok(chrome.includes('dz-desktop-bottom'));
  assert.equal(chrome.includes('className="rail"'),false);
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
  assert.ok(intakeListRoute.includes("u.set('im', month)"));
  assert.ok(intakeListRoute.includes("u.set('iv', '취소')"));
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
