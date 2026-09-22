import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8');
const root=read('src/app/page.tsx');
const designRoute=read('src/app/design/page.tsx');
const intakeListRoute=read('src/app/intake/list/page.tsx');
const chrome=read('src/app/_design/AdminChrome.tsx');
const tabs=read('src/app/_design/MobileTabBar.tsx');
const workspace=read('src/app/products/workspace.tsx');
const intakeForm=read('src/app/intake/new/IntakeForm.tsx');
const settlementPage=read('src/app/settlement/page.tsx');
/* ★2026-09-22 판갈이 — 정산 = 거래처×달 묶음(settlement/board) · 실적 = 건별 대조(performance/board) · 접수 = intake/board */
const settlementBoard=read('src/app/settlement/board.tsx');
const performanceBoard=read('src/app/performance/board.tsx');
const intakeBoard=read('src/app/intake/IntakeSide.tsx');
const claimDoor=read('src/app/c/[token]/ClaimDoor.tsx');
const claimLinkUi=read('src/app/settlement/LifeForms.tsx');
const intakeDetail=read('src/app/intake/IntakeDetailPanel.tsx');
const css=[read('src/app/globals.css'),read('src/app/_design/admin-final.css')].join('\n');

test('admin root enters the real intake workspace and contains no demo runtime',()=>{
  assert.ok(/redirect\(['"]\/intake['"]\)/.test(root));
  assert.equal(/INITIAL_APPS|const\s+PRODUCTS\s*=|demoData|fixtureData|MOCK_/.test(root),false);
});

test('admin chrome exposes the operational lanes without a legacy left rail',()=>{
  /* ★2026-09-22 — PC 상단 메뉴와 폰 하단바는 같은 다섯 걸음 지도(MobileTabBar.TABS)를 쓴다 */
  assert.ok(tabs.includes("['상품', '/products']"));
  assert.ok(tabs.includes("['접수', '/intake?v=work']"));
  assert.ok(tabs.includes("['계약', '/esign']"));
  assert.ok(tabs.includes("['실적', '/performance']"));
  assert.ok(tabs.includes("['정산', '/settlement']"));
  assert.ok(chrome.includes('<TopMenu />'));
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
  assert.equal(settlementBoard.includes('업무 규칙이 굳으면'),false);
  /* 묶음(발행 · 청구 링크)은 정산, 건의 확인·정정·계산서·수금/지급은 실적 */
  assert.ok(settlementBoard.includes('<IssueForm'));
  assert.ok(settlementBoard.includes('확인·정정·수금/지급은 「실적」'));
  assert.ok(performanceBoard.includes('확인 · 정정 · 계산서 · 수금/지급'));
});


test('intake settlement handoff carries focus and settlement resolves it',()=>{
  assert.ok(intakeBoard.includes('/performance?ic=${encodeURIComponent(r.id)}'));
  assert.ok(performanceBoard.includes('locateSettlementFocus'));
  /* 옛 주소(?focus=)는 실적 대조로 넘긴다 */
  assert.ok(settlementPage.includes("sp(q.focus)"));
  assert.ok(settlementPage.includes('redirect(`/performance?ic='));
  assert.ok(settlementBoard.includes("u.delete('focus')"));
});


test('settlement completed row offers next actionable work',()=>{
  assert.ok(performanceBoard.includes('다음 할 일'));
  assert.ok(performanceBoard.includes('다음건'));
});


test('settlement completed queue can continue to the next actionable party',()=>{
  assert.ok(settlementBoard.includes('nextActionableLedgerParty'));
  assert.ok(settlementBoard.includes('다음 거래처'));
});


test('focused settlement miss stays fail-closed and points back to intake',()=>{
  assert.ok(performanceBoard.includes('focusMiss'));
  assert.ok(performanceBoard.includes('접수 상세에서 막힘 확인'));
  assert.ok(performanceBoard.includes('/intake?ic='));
});


test('settlement supplier flow places invoice before collection',()=>{
  assert.ok(performanceBoard.includes('settlementPrimaryAction'));
  assert.ok(performanceBoard.includes("primary === 'invoice'"));
  assert.ok(performanceBoard.includes('계산서 끊기'));
  assert.ok(performanceBoard.includes('biz={장?.partyBizNo}'));
});


test('supplier lifecycle renders invoice as an explicit step',()=>{
  assert.ok(intakeDetail.includes("['접수', '청구', '확인', '계산서', '수금']"));
  assert.ok(intakeDetail.includes("r.progress.invoiceIssued ? '수금' : '계산서'"));
  assert.ok(performanceBoard.includes("['접수', '청구', '확인', '계산서', '수금']"));
  assert.ok(performanceBoard.includes("r?.progress.invoiceIssued ? '수금' : '계산서'"));
});


test('settlement UI separates document progress from cash completion',()=>{
  assert.ok(settlementBoard.includes("ax === 'claim' ? '청구서 보냄' : '지급 통보'"));
  assert.ok(settlementBoard.includes("ax === 'claim' ? '수금 완료' : '지급 완료'"));
  assert.ok(settlementBoard.includes('g.completed'));
});


test('claim rows stay active until collection completes',()=>{
  assert.ok(settlementBoard.includes("ax === 'claim' ? r.progress.collected : r.progress.paid"));
});


test('claim link renders authoritative final response and lock state',()=>{
  assert.ok(claimDoor.includes('res?.ok ? res.response'));
  assert.ok(claimDoor.includes('받은답.codes?.length'));
  assert.ok(claimLinkUi.includes('사업자번호 오입력'));
  assert.ok(claimLinkUi.includes('잠김'));
  assert.ok(settlementBoard.includes('locked={!!장.lockedUntil && 장.lockedUntil > Date.now()}'));
});
