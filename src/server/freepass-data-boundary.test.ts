import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).replaceAll('\\', '/');
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

test('UI and services cannot bypass Catalog or Admin workflow composition roots', () => {
  const violations = [...sources('src/app'), ...sources('src/services')].filter((path) =>
    /(?:from|import\()\s*['"][^'"]*(?:adapters\/erp5|firebase-admin|firebase\/database)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, []);
});

test('FreePass Data catalog authority never absorbs Admin workflow ownership', () => {
  const catalog = readFileSync('src/server/freepass-data.ts', 'utf8');
  const workflows = readFileSync('src/server/erp5.ts', 'utf8');
  assert.match(catalog, /new AdminCatalogSwitchboard\(legacyProducts, freepassDataProducts\)/);
  assert.doesNotMatch(catalog, /Erp5SettlementRepository|Erp5ContractRepository|esignRepository|firebase-admin/);
  assert.match(workflows, /new Erp5SettlementRepository\(\)/);
  assert.match(workflows, /new Erp5ContractRepository\(\)/);
  assert.doesNotMatch(workflows, /new Erp5ProductRepository|firebase-admin/);
});

test('Catalog callers never reach directly for ERP5 product persistence', () => {
  const allowed = new Set(['src/server/freepass-data.ts']);
  const violations = sources('src/server').filter((path) => !allowed.has(path)
    && /from\s+['"][^'"]*adapters\/erp5\/product-repository/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, []);
});
