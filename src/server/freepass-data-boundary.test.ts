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

test('browser Firebase SDK remains auth-only; Firestore uses the server gateway', () => {
  const violations = sources('src').filter((path) =>
    /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s*)['"](?:firebase\/firestore(?:\/[^'"]*)?|@firebase\/firestore)['"]/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(violations, [], 'client Firestore requires a fresh dependency compatibility review');
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

  /**
   * Assert on what the file DOES, not on what it says. Three assertions in this suite have now
   * tripped on their own explanatory comments, which is a test reporting a fault that is not there.
   */
  const code = (path: string) => readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const identity = code('src/server/identity.ts');
  // Identity never touches operational data, and never the retired ERP3/RTDB.
  assert.doesNotMatch(identity, /from ['"][^'"]*(?:adapters\/erp5|firebase\/database)/);
  assert.doesNotMatch(identity, /freepasserp3|AUTH_PROJECT_ID|ADMIN_EMAILS|ADMIN_UIDS/);
  const collections = [...identity.matchAll(/\.collection\('([^']+)'\)|\.collection\((\w+)\)/g)];
  assert.equal(collections.length, 1, 'identity reads exactly one collection');
  assert.match(identity, /const ACCOUNTS = 'identity_accounts'/);
  // The WIF REST read is bound to the same single collection as the emulator SDK path.
  assert.equal((identity.match(/fetch\(/g) ?? []).length, 1);
  assert.match(identity, /fetch\('https:\/\/firestore\.googleapis\.com\/v1\/projects\/' \+ config\.projectId/);
  assert.match(identity, /'\/databases\/\(default\)\/documents\/' \+ ACCOUNTS \+ '\/' \+ encodeURIComponent\(id\)/);
  assert.doesNotMatch(identity, /method:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/);
  // The contract forbids an application minting its own session token or keeping its own allowlist.
  assert.match(identity, /createSessionCookie/);
  // Owner, 2026-09-27: the door asks only whether this is a real colleague, because FreePass
  // Data's approval overwrites grants with ['audit-dashboard'] and nothing can grant this app.
  // Pinned so it cannot drift back silently in either direction: restoring the grant check is a
  // deliberate edit here too, once that side merges grants per application.
  assert.doesNotMatch(identity, /grants\.includes\(APP_GRANT\)/);
  assert.match(identity, /a\?\.status === 'APPROVED'/);
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
  const door = code('src/server/auth.ts');
  assert.doesNotMatch(door, /from ['"][^'"]*firebase|getFirestore\(|getAuth\(|initializeApp\(|\.collection\(/);
  assert.doesNotMatch(code('src/app/login/actions.ts'), /signIn\(|password/i);
  // The shared screen is worn, not edited: the app passes brand and policy only.
  const worn = code('src/app/login/LoginScreen.tsx');
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

test('operator parity audit is read-only, bounded and fail-closed', async () => {
  const row = {
    id: 'P-1', version: 1, supplierId: 'S-1', supplierProductKey: 'P-1',
    vehicle: {
      nodeId: 'V-1', originId: 'KR', manufacturerId: 'HYUNDAI', modelId: 'AVANTE',
      matchLevel: 'MODEL' as const,
    },
    specs: {}, offers: [], productPolicies: [], sourceSnapshotId: 'snapshot-1',
    updatedAt: '2026-09-29T00:00:00.000Z',
  } satisfies import('../domain/product/types').CanonicalProduct;
  const meta = {
    consumerId: 'freepass-admin-catalog' as const,
    projectionId: 'admin-catalog' as const,
    authority: 'CANONICAL_ACTIVE' as const,
    schemaVersion: '1.0.0' as const,
    releaseId: 'rel-1', manifestId: 'manifest-1', inputDigest: 'input-1',
    revision: 1, dataDigest: 'data-1', policyParity: 'COMPLETE' as const,
    commercialCoverage: 'COMPLETE' as const,
    generatedAt: '2026-09-29T00:00:00.000Z',
    activatedAt: '2026-09-29T00:00:00.000Z',
    missingPolicyOfferIds: [], invalidPolicyFactRefs: [], commercialMissingOfferIds: [],
  };
  const matched = await gateway.runAdminCatalogParityAudit({
    configured: true,
    readLegacy: async () => [row],
    readFreepass: async () => ({ rows: [row], meta }),
    now: () => Date.parse('2026-09-29T00:00:00.000Z'),
  });
  assert.equal(matched.readiness, 'READY');
  assert.equal(matched.comparisonStatus, 'MATCH');
  assert.deepEqual(matched.holdReasons, []);

  const held = await gateway.runAdminCatalogParityAudit({
    configured: true,
    readLegacy: async () => [row],
    readFreepass: async () => { throw new Error('secret-bearing transport detail'); },
  });
  assert.equal(held.readiness, 'HOLD');
  assert.equal(held.errorCode, 'FREEPASS_DATA_PARITY_AUDIT_FAILED');
  assert.equal(JSON.stringify(held).includes('secret-bearing'), false);

  const timed = await gateway.runAdminCatalogParityAudit({
    configured: true,
    readLegacy: () => new Promise(() => undefined),
    readFreepass: async () => ({ rows: [row], meta }),
    timeoutMs: 5,
  });
  assert.equal(timed.errorCode, 'FREEPASS_DATA_PARITY_AUDIT_TIMEOUT');

  const missing = await gateway.runAdminCatalogParityAudit({
    configured: false,
    readLegacy: async () => { throw new Error('must not read'); },
    readFreepass: async () => { throw new Error('must not read'); },
  });
  assert.equal(missing.readiness, 'NOT_CONFIGURED');
});
