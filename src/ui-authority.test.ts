import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const exists = (p: string) => existsSync(resolve(root, p));
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function textFiles(dir: string): string[] {
  const full = resolve(root, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).flatMap((name) => {
    const child = resolve(full, name);
    const rel = child.slice(root.length + 1).replaceAll('\\', '/');
    return statSync(child).isDirectory()
      ? textFiles(rel)
      : /\.(md|json)$/.test(name) ? [rel] : [];
  });
}

test('UI authority surface is singular and contains only current SSOT documents', () => {
  const uiDir = resolve(root, 'docs/ui');
  const names = readdirSync(uiDir).sort();
  assert.deepEqual(names, [
    'ADMIN-UI-UX-SSOT.md',
    'DESIGN-AUTHORITY.md',
    'admin-ui-ux-ssot.json',
  ]);

  for (const path of [
    'src/app/_design/theme.ts',
    'src/app/theme/route.ts',
    'scripts/sync-erp-standard.mjs',
    'src/app/_erp/erp-standard.source.json',
    '.ai-core/ui-ux.consumer.json',
    '.devcenter/design-authority.json',
    '.devcenter/design-job.json',
    '.devcenter/visual-job.json',
    'scripts/check-uiux-consumer.mjs',
  ]) assert.equal(exists(path), false, path);

  const chrome = read('src/app/_design/AdminChrome.tsx');
  const shell = read('src/app/_erp/shell.css');
  const css = read('src/app/_erp/erp-standard.css');

  assert.equal(chrome.includes('ThemeSwitch'), false);
  assert.equal(chrome.includes('data-theme='), false);
  assert.equal(shell.includes('data-theme='), false);
  assert.equal(css.includes('data-theme='), false);
});

test('actual-route UI remains the declared authority', () => {
  const authority = read('docs/ui/DESIGN-AUTHORITY.md');
  for (const route of ['/products', '/intake', '/settlement', '/esign']) assert.ok(authority.includes(route), route);
  for (const file of [
    'src/app/_erp/Workspace.tsx',
    'src/app/_erp/ProductsScreen.tsx',
    'src/app/_erp/SettlementScreen.tsx',
    'src/app/_erp/EsignScreen.tsx',
    'src/app/_erp/parts.tsx',
    'src/app/_erp/ProductDetail.tsx',
    'src/app/_erp/erp-standard.css',
    'src/app/_erp/shell.css',
  ]) assert.ok(authority.includes(file), file);
});


test('current project documents contain no removed UI source references', () => {
  const docs = ['AGENTS.md', 'PROJECT.md', ...textFiles('docs'), ...textFiles('.ai-core')];
  const forbidden = [
    'docs/ui/mockups/',
    'docs/ui/reference/',
    'admin-product-to-application.html',
    '.devcenter/design-authority.json',
    '.devcenter/design-job.json',
    '.devcenter/visual-job.json',
    '.ai-core/ui-ux.consumer.json',
  ];
  const hits = docs.flatMap((path) => {
    const body = read(path);
    return forbidden.filter((needle) => body.includes(needle)).map((needle) => path + ' -> ' + needle);
  });
  assert.deepEqual(hits, []);
});

test('PR #92 PC screen is the user-approved canonical UI and other lineages stay discarded (2026-09-26)', () => {
  const authority = read('docs/ui/DESIGN-AUTHORITY.md');
  assert.ok(authority.includes('CANONICAL — USER APPROVED 2026-09-26'), 'authority status');
  assert.ok(authority.includes('## 폐기 (DISCARDED)'), 'discard list');
  const registry = JSON.parse(read('registry/active-work.json')) as {
    ui_authority?: { status?: string; lineage?: string };
    archived?: { branch: string; status: string }[];
  };
  assert.equal(registry.ui_authority?.status, 'CANONICAL_USER_APPROVED');
  for (const branch of ['work/uiux', 'work/function', 'work/esign']) {
    assert.equal(registry.archived?.find((a) => a.branch === branch)?.status, 'DISCARDED', branch);
  }
  // PC 골격 = #92: 좌측 메뉴 + 규격 화면. 옛 셸 · 목업이 돌아오면 실패한다.
  const chrome = read('src/app/_design/AdminChrome.tsx');
  assert.ok(chrome.includes('<SideMenu'), 'PC side menu');
  assert.ok(chrome.includes('erp-topbar'), 'PC top bar');
  assert.equal(exists('docs/ui/mockups'), false, 'mockups stay deleted');
});
