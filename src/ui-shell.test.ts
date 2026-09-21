import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8');
const root=read('src/app/page.tsx');
const chrome=read('src/app/_design/AdminChrome.tsx');
const workspace=read('src/app/products/workspace.tsx');
const intakeForm=read('src/app/intake/new/IntakeForm.tsx');
const css=read('src/app/globals.css');

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
