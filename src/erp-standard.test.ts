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

test('settlement is panelized like the intake workspace, not a standalone §4 page', () => {
  // 대표 2026-09-24 「모든 페이지는 다 패널화 돼 있다 … 정산관리는 이거 공통규격이 아니잖아」 — §4
  // PageHeader/erp-cols 골격을 걷어내고 §5-4 erp-panel 셋(청구목록 | 정산상세 | 지급목록)으로 다시 짰다
  // (대표 2026-09-24 「왼쪽 패널에다가 청구, 가운데 상세, 오른쪽에 지급이야」 — 실적 화면과 같은 결).
  const src = read('src/app/_erp/SettlementScreen.tsx');
  assert.equal(src.includes('<PageHeader'), false, 'no standalone page header — panels carry their own PanelHead');
  assert.equal(src.includes('erp-cols'), false, 'no §4 two-column card grid');
  assert.ok(src.includes('<Panel') && src.includes('<PanelHead') && src.includes('<PanelBody') && src.includes('<PanelFoot'), 'built from §5-4 panel parts');
  assert.ok(src.includes('<RowCards') && src.includes('<RowCard '), 'long card list');
  assert.ok(src.includes('<SearchBar'), 'search bar');
  // 목록 kind 판(청구목록 · 지급목록)은 둘 다 compact — 다른 목록 판과 같은 규격(대표 2026-09-24
  // 「목록 패널은 좀 제발 좀 목록 패널에 맞게끔 하라고」)
  assert.equal((src.match(/<Panel compact>/g) ?? []).length, 3, '청구목록·지급목록 목록 판(+오류 화면)이 compact');
  assert.ok(src.includes('<IssueForm'), '발행 폼은 가운데 정산상세 판에 있다');
  assert.equal(/style=\{\{/.test(src), false, 'no inline style');
});

test('two desktop screens are still built from the older §4 skeleton regions', () => {
  const screens = {
    'src/app/_erp/ProductsScreen.tsx': [],
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
