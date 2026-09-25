import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const exists = (p: string) => existsSync(resolve(root, p));
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

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
