import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const IDENTITY = 'src/server/identity.ts';
const ACCOUNT_COLLECTION = 'identity_accounts';

/**
 * Explicit direct-SDK exceptions only:
 * - firestore.ts: isolated local Firestore emulator composition root; production uses FreePass Data.
 * - esign-repository.ts: Storage transport remains blocked in production while e-sign is off.
 * - identity.ts: shared Firebase Auth + identity_accounts only; never operational business data.
 */
const explicitExceptions = new Set([
  'src/adapters/erp5/firestore.ts',
  'src/adapters/erp5/esign-repository.ts',
  IDENTITY,
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '__tests__'].includes(entry.name)) return [];
      return walk(absolute);
    }
    return /\.tsx?$/.test(entry.name) ? [absolute] : [];
  });
}

const exceptionsSeen = [];
const violations = [];

for (const file of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (rel === 'src/adapters/erp5/demo.ts') continue;
  const text = fs.readFileSync(file, 'utf8');
  const runtimeText = text.replace(/import\s+type\s+[^;]+from\s+['"][^'"]+['"];?/g, '');

  const directSdk =
    /from\s+['"]firebase-admin\/(?:app|auth|firestore|storage|database)['"]/.test(runtimeText)
    || /from\s+['"]firebase\/(?:auth|firestore|database|storage)['"]/.test(runtimeText);
  // Ownership means runtime code actually reads the credential from process.env.
  // Deployment validators and regression tests are allowed to mention the forbidden key names.
  const businessCredential =
    /process\.env\.(?:ERP5_FIREBASE_SERVICE_ACCOUNT_JSON|ERP5_SERVICE_ACCOUNT_PATH)/.test(runtimeText);

  if (!directSdk && !businessCredential) continue;

  if (rel === IDENTITY) {
    const collections = [...runtimeText.matchAll(/\.collection\((?:'([^']+)'|([A-Z_]+))\)/g)]
      .map((m) => m[1] ?? m[2]);
    const named = [...new Set(collections)];
    const bound = runtimeText.replace(/\s+/g, ' ').includes(`= '${ACCOUNT_COLLECTION}'`);
    if (/adapters\/erp5/.test(runtimeText)) violations.push(`${rel} must not reach an ERP5 adapter`);
    else if (businessCredential) violations.push(`${rel} must not read ERP5 business-data credentials`);
    else if (named.length !== 1) violations.push(`${rel} must read exactly one collection, saw ${named.join(', ') || 'none'}`);
    else if (!bound) violations.push(`${rel} must bind its collection to '${ACCOUNT_COLLECTION}'`);
    else exceptionsSeen.push(rel);
    continue;
  }

  if (businessCredential) {
    violations.push(`${rel} must not own ERP5 business-data credentials`);
    continue;
  }
  if (explicitExceptions.has(rel)) exceptionsSeen.push(rel);
  else violations.push(rel);
}

for (const rel of explicitExceptions) {
  if (!fs.existsSync(path.join(root, rel))) {
    violations.push(`authority exception no longer exists and must be removed: ${rel}`);
  }
}

if (violations.length) {
  console.error('FreePass Data authority violation: Admin directly owns Firebase business-data access.');
  for (const rel of [...new Set(violations)].sort()) console.error('- ' + rel);
  process.exit(1);
}

console.log('FreePass Data authority guard OK.');
if (exceptionsSeen.length) {
  console.log('Explicit emulator / e-sign / identity exceptions:');
  for (const rel of [...new Set(exceptionsSeen)].sort()) console.log('- ' + rel);
}
