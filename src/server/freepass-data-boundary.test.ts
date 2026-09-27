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

test('server helpers cannot reach persistence on their own; identity reaches only the shared account authority', () => {
  // Owner, 2026-09-27: the shared login screen and the account authority both come from FreePass Data
  // (IDENTITY-AND-ACCESS.md). Identity may reach Firebase Auth and the shared identity_accounts
  // collection and nothing else; operational data still goes through the gateway alone.
  const allowed = new Set(['src/server/freepass-data.ts', 'src/server/identity.ts']);
  const violations = sources('src/server').filter((path) => !allowed.has(path)
    && /(?:from|import\()\s*['"][^'"]*(?:adapters\/erp5|firebase-admin|firebase\/database)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, []);

  const identity = readFileSync('src/server/identity.ts', 'utf8');
  // Identity never touches operational data, and never the retired ERP3/RTDB.
  assert.doesNotMatch(identity, /from ['"][^'"]*(?:adapters\/erp5|firebase\/database)/);
  assert.doesNotMatch(identity, /freepasserp3|AUTH_PROJECT_ID|ADMIN_EMAILS|ADMIN_UIDS/);
  const collections = [...identity.matchAll(/\.collection\('([^']+)'\)|\.collection\((\w+)\)/g)];
  assert.equal(collections.length, 1, 'identity reads exactly one collection');
  assert.match(identity, /const ACCOUNTS = 'identity_accounts'/);
  // The contract forbids an application minting its own session token or keeping its own allowlist.
  assert.match(identity, /createSessionCookie/);
  // Emulator journey cannot prove these two, so pin them here instead of letting them drift.
  // Revocation must be checked (the Auth emulator does not implement it for session cookies).
  assert.match(identity, /verifySessionCookie\(cookie, true\)/);
  // An unreachable authority denies rather than admits.
  assert.match(identity, /catch \{ who = null; \}/);
  assert.doesNotMatch(identity, /createHmac|scrypt|passwordHash/);
  // Authority must be re-resolved often enough that revocation lands (contract: at most 5 minutes).
  const ttl = identity.match(/AUTHORITY_TTL_MS = ([^;]+);/)?.[1] ?? '';
  assert.ok(/5 \* 60_000/.test(ttl), `authority cache must stay within 5 minutes, saw ${ttl}`);

  // The door itself holds no database and no password.
  const door = readFileSync('src/server/auth.ts', 'utf8');
  assert.doesNotMatch(door, /from ['"][^'"]*firebase|getFirestore\(|getAuth\(|initializeApp\(|\.collection\(/);
  assert.doesNotMatch(readFileSync('src/app/login/actions.ts', 'utf8'), /signIn\(|password/i);
  // The shared screen is worn, not edited: the app passes brand and policy only.
  const worn = readFileSync('src/app/login/LoginScreen.tsx', 'utf8');
  assert.match(worn, /policy: 'APPROVAL'/);
  assert.match(worn, /from '\.\/shared\/login\.js'/);
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
