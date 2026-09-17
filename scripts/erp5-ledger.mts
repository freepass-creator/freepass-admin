/**
 * ERP5 `settlement_rows` 를 «읽어» 실적 스냅샷을 낸다. ★아무것도 쓰지 않는다.
 *
 *   npx tsx scripts/erp5-ledger.mts [--month 2026-09] [--out docs/ui/mockups/erp5.ledger.js]
 *
 * ★읽은 줄 = 실은 줄 + 보류한 줄. 이 등식이 안 맞으면 조용히 사라진 것이 있다.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { toSettlementRow } from '../src/adapters/erp5/to-settlement.ts';
import { blockOf, isOpenIntake, isPerformance, margin } from '../src/domain/settlement/types.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SA = arg('--sa', 'C:/dev/freepasserp4-rtdb-current/tmp/firebase-auth/freepasserp5-sa.json');
const OUT = arg('--out', 'docs/ui/mockups/erp5.ledger.js');
const MONTH = arg('--month', '2026-09');

const sa = JSON.parse(readFileSync(SA, 'utf8'));
if (sa.project_id !== 'freepasserp5') throw new Error(`★ERP5 가 아니다: ${sa.project_id}`);
const db = getFirestore(initializeApp({ credential: cert(sa), projectId: sa.project_id }, 'ledger'));

const won = (x: number | null) => x === null ? '모름' : Math.round(x).toLocaleString('ko-KR');
const snapshotId = `stl-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;

const docs = (await db.collection('settlement_rows').get()).docs;
console.error(`■ ERP5 settlement_rows ${docs.length}줄 읽음 (${snapshotId})`);

const rows = [];
const warnCount = new Map<string, number>();
for (const d of docs) {
  const { row, warnings } = toSettlementRow(d.data(), d.id);
  for (const w of warnings) warnCount.set(w.slice(0, 22), (warnCount.get(w.slice(0, 22)) ?? 0) + 1);
  rows.push({ ...row, block: blockOf(row), warnings });
}

/* ★등식 — 읽은 줄이 하나도 안 사라졌나 */
const balanced = rows.length === docs.length;

const live = rows.filter((r) => !r.progress.cancelled);
const open = rows.filter(isOpenIntake);
const perf = rows.filter(isPerformance);
const month = live.filter((r) => r.progress.billMonth === MONTH);

const sum = (a: typeof rows, f: (r: (typeof rows)[number]) => number | null) =>
  a.reduce((n, r) => n + (f(r) ?? 0), 0);
const unknown = (a: typeof rows, f: (r: (typeof rows)[number]) => number | null) =>
  a.filter((r) => f(r) === null).length;

const tally = (a: typeof rows) => ({
  n: a.length,
  claim: sum(a, (r) => r.money.claim), claimUnknown: unknown(a, (r) => r.money.claim),
  pay: sum(a, (r) => r.money.pay),
  margin: sum(a, margin), marginUnknown: unknown(a, margin),
});

const byBlock: Record<string, number> = {};
for (const r of live) { const k = r.block ?? '끝'; byBlock[k] = (byBlock[k] ?? 0) + 1; }

const report = {
  snapshotId, month: MONTH,
  read: docs.length, loaded: rows.length, balanced,
  all: tally(live), open: tally(open), perf: tally(perf), month_: tally(month),
  byBlock,
  fee: {
    supplierFlat: rows.filter((r) => r.supplierFee.mode === 'FLAT').length,
    supplierRate: rows.filter((r) => r.supplierFee.mode === 'RATE').length,
    supplierUnknown: rows.filter((r) => r.supplierFee.mode === 'UNKNOWN').length,
  },
  notWritten: {
    collected: live.filter((r) => r.progress.collected).length,
    paid: live.filter((r) => r.progress.paid).length,
    supplierOk: live.filter((r) => r.progress.supplierOk).length,
    channelOk: live.filter((r) => r.progress.channelOk).length,
  },
  warnings: Object.fromEntries([...warnCount].sort((a, b) => b[1] - a[1])),
};

console.error(`\n■ 셈  읽은 줄 ${report.read} = 실은 줄 ${report.loaded} → ${balanced ? '맞는다 ✓' : '★안 맞는다'}`);
const line = (t: string, x: ReturnType<typeof tally>) =>
  console.error(`  ${t.padEnd(16)} ${String(x.n).padStart(4)}줄  청구 ${won(x.claim).padStart(13)}`
    + `${x.claimUnknown ? ` (모름 ${x.claimUnknown})` : ''}  지급 ${won(x.pay).padStart(13)}  남는 것 ${won(x.margin).padStart(12)}`);
line('전체(취소 뺀)', report.all);
line('★현재 접수', report.open);
line('실적(인도됨)', report.perf);
line(`★${MONTH} 청구`, report.month_);

console.error('\n■ ★무엇에 막혀 있나 (취소 뺀 것)');
for (const [k, v] of Object.entries(byBlock).sort((a, b) => b[1] - a[1])) console.error(`  ${k.padEnd(14)} ${v}`);
console.error('\n■ 수수료 꼴');
console.error(`  비율 ${report.fee.supplierRate} · ★정액 ${report.fee.supplierFlat} · 모름 ${report.fee.supplierUnknown}`);
console.error('\n■ ★칸은 있는데 안 채운 것');
for (const [k, v] of Object.entries(report.notWritten)) console.error(`  ${k.padEnd(12)} ${v} / ${live.length}`);
console.error('\n■ 경고');
for (const [k, v] of Object.entries(report.warnings)) console.error(`  ⚠ ${k.padEnd(24)} ${v}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT,
  `/* ★ERP5(freepasserp5) settlement_rows 에서 «읽어» 만든 실적 스냅샷. 손으로 고치지 마라.\n`
  + `   만든 때 ${new Date().toISOString()} · ${snapshotId}\n`
  + `   다시 만들기: npx tsx scripts/erp5-ledger.mts\n`
  + `   읽은 줄 ${report.read} = 실은 줄 ${report.loaded} */\n`
  + `const STL = ${JSON.stringify({ report, rows }, null, 1)};\n`, 'utf8');
console.error(`\n■ 냈다 → ${OUT}`);
if (!balanced) process.exitCode = 1;
