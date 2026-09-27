import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as gateway from './freepass-data';
import * as compatibility from './erp5';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).replaceAll('\\', '/');
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

test('UI and services cannot bypass the FreePass Data persistence gateway', () => {
  const violations = [...sources('src/app'), ...sources('src/services')].filter((path) =>
    /(?:from|import\()\s*['"][^'"]*(?:adapters\/erp5|firebase-admin|firebase\/database)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, []);
});

test('one FreePass Data gateway composes catalog and workflow persistence without owning business commands', () => {
  const data = readFileSync('src/server/freepass-data.ts', 'utf8');
  assert.match(data, /new AdminCatalogSwitchboard\(legacyProducts, freepassDataProducts\)/);
  assert.match(data, /new FreePassDataAdminCompatProductRepository\(\)/);
  assert.match(data, /adminCatalogReadMode\(\) === 'LEGACY_DIRECT'/);
  assert.match(data, /!adminCompatibilityTransportConfigured\(\)/);
  assert.match(data, /new Erp5SettlementRepository\(\)/);
  assert.match(data, /new Erp5ContractRepository\(\)/);
  assert.match(data, /export \{ esignAssets, esignRepository \} from/);
  assert.doesNotMatch(data, /firebase-admin|new EsignService|from ['"][^'"]*services\//);
});

test('server helpers cannot independently reach operational persistence; identity keeps no database at all', () => {
  // Owner's 2026-09-27 decision supersedes 2026-09-18: ERP3/ERP4 is retired, so the login authority is
  // Google Workspace alone. Identity now holds no persistence of any kind -- no ERP3 Auth, no user directory.
  const allowed = new Set(['src/server/freepass-data.ts']);
  const violations = sources('src/server').filter((path) => !allowed.has(path)
    && /(?:from|import\()\s*['"][^'"]*(?:adapters\/erp5|firebase-admin|firebase\/database)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, []);
  const identity = readFileSync('src/server/auth.ts', 'utf8');
  assert.doesNotMatch(identity, /from ['"][^'"]*(?:adapters\/erp5|firebase-admin|firebase\/database)/);
  assert.doesNotMatch(identity, /getFirestore|getAuth|initializeApp|\.collection\(/);
  // The retired ERP3 login must not come back through configuration either.
  assert.doesNotMatch(identity, /process\.env\.(?:AUTH_PROJECT_ID|AUTH_FIREBASE_SERVICE_ACCOUNT_JSON|AUTH_SERVICE_ACCOUNT_PATH|FIREBASE_WEB_API_KEY|ADMIN_EMAILS|ADMIN_UIDS)/);
  assert.doesNotMatch(readFileSync('src/app/login/actions.ts', 'utf8'), /signIn|password/i);
});

test('deprecated ERP5 alias preserves gateway instance identity instead of creating a second ledger', () => {
  const alias = readFileSync('src/server/erp5.ts', 'utf8');
  assert.doesNotMatch(alias, /adapters\/|new Erp5|const |function /);
  assert.equal(compatibility.settlements, gateway.settlements);
  assert.equal(compatibility.contracts, gateway.contracts);
  assert.equal(compatibility.esignRepository, gateway.esignRepository);
  assert.equal(compatibility.esignAssets, gateway.esignAssets);
  assert.equal(compatibility.productByIdFresh, gateway.productByIdFresh);
  assert.equal(compatibility.writeEnabled, gateway.writeEnabled);
});

test('electronic-signature service obtains persistence through Data while retaining renderer ownership', () => {
  const source = readFileSync('src/server/esign.ts', 'utf8');
  assert.match(source, /esignAssets, esignRepository \} from '\.\/freepass-data'/);
  assert.match(source, /new EsignService\(esignRepository, esignAssets, esignFinalDocumentRenderer\)/);
  assert.doesNotMatch(source, /adapters\/erp5/);
});


test('cutover stages never reuse the 60-second legacy UI cache', () => {
  const data = readFileSync('src/server/freepass-data.ts', 'utf8');
  assert.match(data, /const cacheable = mode === 'LEGACY_DIRECT' \|\| mode === 'OBSERVE'/);
  assert.match(data, /if \(cacheable && hit && hit\.mode === mode && Date\.now\(\) - hit\.at < TTL\)/);
  assert.match(data, /else delete g\.__fpaCatalog/);
});
