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
]);

/**
 * Identity is not business data. The shared contract (freepass-data
 * docs/IDENTITY-AND-ACCESS.md §1) keeps credentials in Firebase Authentication and the approval
 * record in `identity_accounts`, and explicitly allows a consumer application to hold Firebase Auth
 * for user identity while forbidding it a business-data credential.
 *
 * So this file may reach Firebase, but it is checked rather than waved through: it must touch the
 * account collection and nothing else, and must not reach an ERP5 adapter. An allowlist entry that
 * is never verified is how "temporary" debt becomes permanent.
 */
const IDENTITY = 'src/server/identity.ts';
const ACCOUNT_COLLECTION = 'identity_accounts';

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

  if (rel === IDENTITY) {
    const collections = [...text.matchAll(/\.collection\((?:'([^']+)'|([A-Z_]+))\)/g)]
      .map((m) => m[1] ?? m[2]);
    const named = [...new Set(collections)];
    /* 공백을 한 칸으로 고른 뒤 그대로 찾는다 — 문자열 안의 \s 는 JS 가 s 로 뭉갠다 */
    const bound = text.replace(/\s+/g, ' ').includes(`= '${ACCOUNT_COLLECTION}'`);
    if (/adapters\/erp5/.test(text)) violations.push(`${rel} must not reach an ERP5 adapter`);
    else if (named.length !== 1) violations.push(`${rel} must read exactly one collection, saw ${named.join(', ') || 'none'}`);
    else if (!bound) violations.push(`${rel} must bind its collection to '${ACCOUNT_COLLECTION}'`);
    continue;
  }

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
