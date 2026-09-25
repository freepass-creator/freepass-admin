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
  for (const token of ['--erp-color-primary: #1B2A4A;', '--erp-topbar-h: 56px;', '--erp-sidenav-w: 240px;', '--erp-grid-row-h: 40px;']) assert.ok(css.includes(token), token);
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

test('products is a two-panel wide-list + detail workspace, not a standalone §4 page', () => {
  // 대표 2026-09-24 「상품 찾기 페이지가 메인이야 … 패널 두 개를 합쳐서 상품 목록을 두 줄로 깔면 돼
  // … 상품 찾기는 목록 패널이 1 곱하기 2짜리가 들어가. 그리고 상세 패널은 계약 접수 페이지에도 있는
  // 그 패널이 동일하게」 — §4 erp-cols(「저 화면은 안 쓰는 거야」)를 걷어내고 §5-4 erp-panel 둘
  // (목록 1×2 wide | 상품상세)로 다시 짰다. 상세 판은 계약접수와 같은 부품(ProductDetail)을 쓴다.
  const src = read('src/app/_erp/ProductsScreen.tsx');
  assert.equal(src.includes('<PageHeader'), false, 'no standalone page header — panels carry their own PanelHead');
  assert.equal(src.includes('erp-cols'), false, 'no §4 two-column card grid');
  assert.ok(src.includes('<Panel compact wide>'), '목록 판은 compact + wide(1×2)');
  assert.ok(src.includes('<ProductDetail'), '상품상세 판은 계약접수와 같은 부품을 재사용, 새로 안 그린다');
  assert.ok(src.includes('<RowCards') && src.includes('<RowCard '), 'long card list');
  assert.ok(src.includes('<SearchBar') && src.includes('filter={<FilterSheet'), 'search bar with filter button');
  assert.equal(/style=\{\{/.test(src), false, 'no inline style');
});

test('esign is a two-panel list + detail workspace, not a standalone §4 page', () => {
  // 대표 2026-09-24 「최종 확정된 규격 말고 페이지 전체 나오거나 했던 것들 … 없애야지」 — 마지막까지
  // 남아 있던 §4 화면(PageHeader · erp-cols · CardHead · Props)을 §5-4 erp-panel 둘(목록 | 상세내용)로 다시 짰다.
  const src = read('src/app/_erp/EsignScreen.tsx');
  assert.equal(src.includes('<PageHeader'), false, 'no standalone page header — panels carry their own PanelHead');
  assert.equal(src.includes('erp-cols'), false, 'no §4 two-column card grid');
  assert.ok(src.includes('<Panel') && src.includes('<PanelHead') && src.includes('<PanelBody') && src.includes('<PanelFoot'), 'built from §5-4 panel parts');
  assert.ok(src.includes('<RowCards') && src.includes('<RowCard '), 'long card list');
  assert.ok(src.includes('<SearchBar') && src.includes('facets={[agentFacet]}'), 'search bar with filter button');
  assert.ok((src.match(/<AutoSelect/g) ?? []).length <= 1, 'at most one classification dropdown');
  assert.equal(/style=\{\{/.test(src), false, 'no inline style');
});

test('no page renders the older §4 skeleton (PageHeader/erp-cols) any more', () => {
  // 대표 2026-09-24 「최종 확정된 규격 말고 페이지 전체 나오거나 했던 것들 네가 한번 띄워봐 … 없애야지」
  // — 상품찾기 · 정산관리 · 전자계약까지 전부 §5-4 erp-panel 로 옮겨, PC 화면 중 §4 골격을 쓰는 곳이
  // 이제 하나도 없다.
  for (const file of ['ProductsScreen.tsx', 'SettlementScreen.tsx', 'EsignScreen.tsx', 'Workspace.tsx']) {
    const src = read(`src/app/_erp/${file}`);
    assert.equal(src.includes('<PageHeader'), false, `${file}: no §4 PageHeader`);
    assert.equal(src.includes('erp-cols'), false, `${file}: no §4 two-column card grid`);
  }
  const parts = read('src/app/_erp/parts.tsx');
  // PageHeader/CardHead/Props(§4 전용 부품)는 부품 목록에서도 걷어냈다 — 화면뿐 아니라 부품도 §4 흔적이 없다.
  assert.equal(parts.includes('export function PageHeader'), false, '§4 PageHeader 부품 자체를 제거');
  assert.equal(parts.includes('export function CardHead'), false, '§4 CardHead 부품 자체를 제거');
  assert.equal(parts.includes('export function Props'), false, '§4 Props 부품 자체를 제거');
  assert.ok(parts.includes('data-region="kpi"') && parts.includes('className="erp-rowcards" data-region="grid"'));
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
