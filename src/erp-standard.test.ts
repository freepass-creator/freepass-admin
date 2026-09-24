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
    'src/app/_erp/ProductsScreen.tsx': [],
    'src/app/_erp/SettlementScreen.tsx': [],
    'src/app/_erp/EsignScreen.tsx': [],
  } as const;
  for (const [file, regions] of Object.entries(screens)) {
    const src = read(file);
    assert.ok(src.includes('<PageHeader'), `${file}: page header`);
    // 요약 카드는 두지 않는다 — 제목 밑에 검색창, 그 밑에 목록(대표 2026-09-23 「요약표는 필요 없어」)
    assert.equal(src.includes('<Kpis'), false, `${file}: no summary cards`);
    assert.ok(src.includes('data-region="grid-toolbar"'), `${file}: status tabs on the toolbar row (standard)`);
    for (const r of regions) assert.ok(src.includes(`data-region="${r}"`), `${file}: region ${r}`);
    // 목록은 긴 카드(규격 §5-3) — 폰으로 그대로 넘어간다(대표 2026-09-23 「카드를 기다랗게 … 그거 규격으로 다 해놓고」)
    assert.ok(src.includes('<RowCards') && src.includes('<RowCard '), `${file}: long card list`);
    assert.equal(src.includes('erp-grid-scroll'), false, `${file}: no table list`);
    assert.equal(/style=\{\{/.test(src), false, `${file}: no inline style`);
    // 조회 = 검색창 + 상세 필터(규격 §5-1) — 라벨 드롭다운 바(erp-filter)를 늘어놓지 않는다
    assert.ok(src.includes('<SearchBar'), `${file}: search bar`);
    assert.equal(src.includes('className="erp-filter"'), false, `${file}: no dropdown filter bar`);
    assert.ok((src.match(/<AutoSelect/g) ?? []).length <= 1, `${file}: at most one classification dropdown`);
  }
  const parts = read('src/app/_erp/parts.tsx');
  assert.ok(parts.includes('data-region="page-header"') && parts.includes('data-region="kpi"') && parts.includes('className="erp-rowcards" data-region="grid"'));
  assert.ok(parts.includes('data-region="filter"') && parts.includes('data-region="grid-toolbar"') && parts.includes('erp-filter-more'));
  // 실적은 새 판이 아니라 접수 목록(3패널 Workspace 세 번째 판)의 실적 칸
  assert.ok(read('src/app/_erp/Workspace.tsx').includes("const 실적칸: Bucket[] = ['분납실적', '완납실적']"));
});

test('each page renders the standard screen for PC and keeps the phone board', () => {
  for (const [page, screen, board] of [
    ['src/app/products/page.tsx', '<ProductsScreen', '<ProductWorkspace'],
    ['src/app/intake/page.tsx', '<WorkspaceScreen', '<ProductWorkspace'],
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
