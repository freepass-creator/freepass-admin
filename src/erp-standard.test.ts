// DEC-2026-09-23-01 — PC 화면은 AI Core «ERP 표준 UI 규격 v1» 을 그대로 쓴다(흉내 금지).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

test('standard CSS is the generated ai-core projection, not a hand copy', () => {
  const css = read('src/app/_erp/erp-standard.css');
  const src = JSON.parse(read('src/app/_erp/erp-standard.source.json')) as { repository: string; revision: string };
  assert.equal(src.repository, 'freepass-creator/ai-core');
  assert.match(src.revision, /^[0-9a-f]{40}$/);
  assert.ok(css.startsWith('/* ⚠ 생성물'), 'generated header');
  assert.ok(css.includes(`@ ${src.revision}`), 'header pins the source revision');
  assert.equal(css.replace(/\/\*[\s\S]*?\*\//g, '').includes('.erp-app'), false, 'root scope is rewritten to .erp-std');
  assert.equal(css.includes('erp-theme-flagbody'), false, 'retro scope rewritten exactly once');
  for (const token of ['--erp-color-primary: #1D4ED8;', '--erp-topbar-h: 56px;', '--erp-sidenav-w: 240px;', '--erp-grid-row-h: 40px;']) assert.ok(css.includes(token), token);
  assert.ok(css.includes('body:has(> .erp-theme-flag[data-theme="retro"]) {'), 'retro theme block');
});

test('five desktop screens are built from the standard skeleton regions', () => {
  const screens = {
    'src/app/_erp/ProductsScreen.tsx': ['filter', 'grid-toolbar', 'grid'],
    'src/app/_erp/IntakeScreen.tsx': ['filter', 'grid-toolbar', 'grid'],
    'src/app/_erp/SettlementScreen.tsx': ['filter', 'grid-toolbar', 'grid'],
    'src/app/_erp/EsignScreen.tsx': ['filter', 'grid-toolbar', 'grid'],
  } as const;
  for (const [file, regions] of Object.entries(screens)) {
    const src = read(file);
    assert.ok(src.includes('<PageHeader'), `${file}: page header`);
    assert.ok(src.includes('<Kpis'), `${file}: KPI row`);
    for (const r of regions) assert.ok(src.includes(`data-region="${r}"`), `${file}: region ${r}`);
    assert.equal(/style=\{\{/.test(src), false, `${file}: no inline style`);
  }
  const parts = read('src/app/_erp/parts.tsx');
  assert.ok(parts.includes('data-region="page-header"') && parts.includes('data-region="kpi"'));
  // 실적은 새 판이 아니라 접수 목록의 실적 칸
  assert.ok(read('src/app/_erp/IntakeScreen.tsx').includes("const 실적칸: Bucket[] = ['분납실적', '완납실적']"));
});

test('each page renders the standard screen for PC and keeps the phone board', () => {
  for (const [page, screen, board] of [
    ['src/app/products/page.tsx', '<ProductsScreen', '<ProductWorkspace'],
    ['src/app/intake/page.tsx', '<IntakeScreen', '<ProductWorkspace'],
    ['src/app/settlement/page.tsx', '<SettlementScreen', '<SettlementBoards'],
    ['src/app/esign/page.tsx', '<EsignScreen', '<EsignBoards'],
  ]) {
    const src = read(page);
    assert.ok(src.includes(screen), `${page}: ${screen}`);
    assert.ok(src.includes(board), `${page}: ${board}`);
  }
  const shell = read('src/app/_erp/shell.css');
  assert.ok(/max-width: 900px[\s\S]*\.erp-screen/.test(shell), 'phone hides the PC screens');
});
