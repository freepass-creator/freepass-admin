/**
 * ERP5(freepasserp5) Firestore 를 «읽어» 상품 스냅샷을 만든다. ★아무것도 쓰지 않는다.
 *
 *   node scripts/erp5-snapshot.mjs [--limit 0] [--out docs/ui/mockups/erp5.data.js]
 *
 * ★세기 전에 옮기지 않는다 — 버린 줄을 갈래별로 세어 «화면에» 남긴다.
 *   실수 장부: 「못 읽은 것을 «없다» 로 끝냈다」 · 「조용히 0」
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { toCanonicalProduct } from '../src/adapters/erp5/to-canonical.ts';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SA = arg('--sa', 'C:/dev/freepasserp4-rtdb-current/tmp/firebase-auth/freepasserp5-sa.json');
const OUT = arg('--out', 'docs/ui/mockups/erp5.data.js');
const LIMIT = Number(arg('--limit', '0'));

const sa = JSON.parse(readFileSync(SA, 'utf8'));
if (sa.project_id !== 'freepasserp5') throw new Error(`★ERP5 가 아니다: ${sa.project_id}`);
const db = getFirestore(initializeApp({ credential: cert(sa), projectId: sa.project_id }, 'snap'));

const snapshotId = `erp5-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
console.error(`■ ERP5 읽는 중 … (${snapshotId})`);

/* ── 정책 먼저 — 지워진 것은 뺀다 ───────────────────────────── */
const polSnap = await db.collection('policy').get();
const policies = new Map();
let deletedPolicies = 0;
for (const d of polSnap.docs) {
  const x = d.data();
  if (x._deleted === true) { deletedPolicies++; continue; }
  policies.set(d.id, x);
  const code = String(x.policy_code ?? '').trim();
  if (code && code !== d.id) policies.set(code, x);
}
console.error(`  정책 ${polSnap.size}벌 — 살아 있는 것 ${policies.size} · 지워진 것 ${deletedPolicies}`);

/* ── 상품 ───────────────────────────────────────────────────── */
let q = db.collection('products');
if (LIMIT > 0) q = q.limit(LIMIT);
const prodSnap = await q.get();
console.error(`  상품 ${prodSnap.size}줄 읽음`);

const products = [];
const skipped = { NOT_LISTABLE: 0, NO_CAR_NUMBER: 0, NO_PRICE: 0, NO_VALID_OFFER: 0 };
const warnCount = new Map();
const suppliers = new Map();
let noPolicy = 0;

for (const doc of prodSnap.docs) {
  const d = doc.data();
  const code = String(d.policy_code ?? '').trim();
  const policy = code ? policies.get(code) : undefined;
  if (code && !policy) noPolicy++;

  const r = toCanonicalProduct(d, doc.id, policy, snapshotId);
  if (!r.ok) { skipped[r.reason]++; continue; }

  for (const w of r.warnings) {
    const kind = w.split(' ')[0];
    warnCount.set(kind, (warnCount.get(kind) ?? 0) + 1);
  }
  const sup = String(d.provider_name ?? '').trim() || r.product.supplierId;
  suppliers.set(r.product.supplierId, sup);

  /* 화면이 바로 쓰는 꼴로 살을 조금 더 붙인다 — 원자는 그대로 두고 «보기» 만 더한다 */
  products.push({
    ...r.product,
    supplierName: sup,
    status: String(d.vehicle_status ?? d.status ?? '').trim(),
    statusKind: String(d.status_kind ?? '').trim(),
    color: String(d.ext_color ?? '').trim() || undefined,
    photo: String(d.photo_link ?? '').trim() || (Array.isArray(d.image_urls) ? String(d.image_urls[0] ?? '') : '') || undefined,
    consumerPrice: Number(d.consumer_price) || undefined,
    warnings: r.warnings,
  });
}

const totalSkipped = Object.values(skipped).reduce((a, b) => a + b, 0);
const offerCount = products.reduce((n, p) => n + p.offers.length, 0);

/* ★읽은 줄 = 실은 줄 + 버린 줄. 이 등식이 안 맞으면 조용히 사라진 것이 있다 */
const balanced = prodSnap.size === products.length + totalSkipped;

const report = {
  snapshotId,
  read: prodSnap.size,
  loaded: products.length,
  skipped,
  totalSkipped,
  balanced,
  offers: offerCount,
  suppliers: suppliers.size,
  policiesAlive: polSnap.size - deletedPolicies,
  policiesDeleted: deletedPolicies,
  policyMissing: noPolicy,
  warnings: Object.fromEntries([...warnCount].sort((a, b) => b[1] - a[1])),
};

console.error('\n■ 셈');
console.error(`  읽은 줄 ${report.read} = 실은 줄 ${report.loaded} + 버린 줄 ${report.totalSkipped}  → ${balanced ? '맞는다 ✓' : '★안 맞는다'}`);
for (const [k, v] of Object.entries(skipped)) if (v) console.error(`    버림 ${k.padEnd(14)} ${v}`);
console.error(`  Offer ${report.offers} · 공급사 ${report.suppliers} · 정책 ${report.policiesAlive}벌`);
for (const [k, v] of Object.entries(report.warnings)) console.error(`    ⚠ ${k.padEnd(14)} ${v}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT,
  `/* ★ERP5(freepasserp5) Firestore 에서 «읽어» 만든 스냅샷. 손으로 고치지 마라.\n`
  + `   만든 때 ${new Date().toISOString()} · ${snapshotId}\n`
  + `   다시 만들기: node scripts/erp5-snapshot.mjs\n`
  + `   읽은 줄 ${report.read} = 실은 줄 ${report.loaded} + 버린 줄 ${report.totalSkipped} */\n`
  + `const ERP5 = ${JSON.stringify({ report, products }, null, 1)};\n`,
  'utf8');
console.error(`\n■ 냈다 → ${OUT}`);
if (!balanced) process.exitCode = 1;
