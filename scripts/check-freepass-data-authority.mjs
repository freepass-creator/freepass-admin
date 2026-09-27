import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const legacyDebt = new Set([
  'src/adapters/erp5/firestore.ts',
  'src/adapters/erp5/product-repository.ts',
  'src/adapters/erp5/settlement-repository.ts',
  'src/adapters/erp5/contract-repository.ts',
  'src/adapters/erp5/esign-repository.ts',
  'src/adapters/erp5/fee-rules.ts',
  'src/adapters/erp5/vehicle-master.ts',
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

const debtSeen = [];
const violations = [];

for (const file of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (rel === 'src/adapters/erp5/demo.ts') continue;
  const text = fs.readFileSync(file, 'utf8');

  const direct =
    /\berp5\s*\(/.test(text) ||
    /from\s+['"]firebase-admin\/(?:app|firestore|storage)['"]/.test(
      text.replace(/import\s+type\s+/g, 'import type ')
    ) && !/import\s+type\s+[^;]+from\s+['"]firebase-admin\/(?:firestore|storage)['"]/.test(text);

  if (!direct) continue;
  if (legacyDebt.has(rel)) debtSeen.push(rel);
  else violations.push(rel);
}

for (const rel of legacyDebt) {
  if (!fs.existsSync(path.join(root, rel))) {
    violations.push(`legacy debt entry no longer exists and must be removed from allowlist: ${rel}`);
  }
}

if (violations.length) {
  console.error('FreePass Data authority violation: Admin added direct Firebase business-data access.');
  for (const rel of [...new Set(violations)].sort()) console.error('- ' + rel);
  process.exit(1);
}

console.log('FreePass Data authority guard OK.');
console.log('Admin migration debt still allowed temporarily:');
for (const rel of [...new Set(debtSeen)].sort()) console.log('- ' + rel);
