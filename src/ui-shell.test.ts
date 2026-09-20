import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page=readFileSync(resolve(process.cwd(),'src/app/page.tsx'),'utf8');
const css=readFileSync(resolve(process.cwd(),'src/app/globals.css'),'utf8');

test('admin approved shell removes legacy quick filter strip',()=>{
  assert.equal(page.includes('quick-filters'),false);
  assert.equal(css.includes('.quick-filters'),false);
  assert.ok(page.includes('세부필터'));
});

test('desktop shell uses left work rail and floating workspace panels',()=>{
  assert.ok(page.includes('className="rail"'));
  assert.ok(page.includes('className="workspace"'));
  assert.ok(css.includes('grid-template-columns:176px minmax(0,1fr)'));
  assert.ok(css.includes('box-shadow:var(--shadow)'));
});

test('offer options are rendered as vertical whole-offer rows',()=>{
  assert.ok(page.includes('className="offer-list"'));
  assert.ok(page.includes('offer-row'));
  assert.ok(page.includes('보증금'));
  assert.ok(page.includes('약정주행'));
});

test('mobile uses explicit view navigation instead of stacking every panel',()=>{
  assert.ok(page.includes("type MobileView = 'products' | 'detail' | 'work'"));
  assert.ok(page.includes('className="mobile-nav"'));
  assert.ok(css.includes('.panel{display:none;'));
  assert.ok(css.includes('.panel.mobile-active{display:block}'));
});

test('primary actions keep a bottom action boundary',()=>{
  assert.ok(page.includes('className="detail-actions"'));
  assert.ok(css.includes('.detail-actions{position:sticky'));
});
