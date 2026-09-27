import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

/**
 * Explicit exceptions only:
 * - firestore.ts: isolated local emulator composition root; production uses FreePass Data.
 * - esign-repository.ts: Storage transport remains blocked in production while e-sign is off.
 * - auth.ts: identity authority exception (ERP4 user directory), not operational business data.
 */
const explicitExceptions = new Set([
  'src/adapters/erp5/firestore.ts',
  'src/adapters/erp5/esign-repository.ts',
  'src/server/auth.ts',
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
    /from\s+['"]firebase-admin\/(?:app|firestore|storage|database)['"]/.test(runtimeText)
    || /from\s+['"]firebase\/(?:firestore|database|storage)['"]/.test(runtimeText);
  const businessCredential =
    /ERP5_FIREBASE_SERVICE_ACCOUNT_JSON|ERP5_SERVICE_ACCOUNT_PATH/.test(runtimeText);

  if (!directSdk && !businessCredential) continue;
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
  console.log('Explicit non-operational / identity exceptions:');
  for (const rel of [...new Set(exceptionsSeen)].sort()) console.log('- ' + rel);
}
