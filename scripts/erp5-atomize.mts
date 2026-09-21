/**
 * 정산 실적을 «원자로 쪼개» Firestore 에 넣는다.
 *
 *   npx tsx scripts/erp5-atomize.mts                 ← ★헛돌기. 아무것도 안 쓴다
 *   npx tsx scripts/erp5-atomize.mts --apply         ← 실제로 쓴다
 *
 * ★대표 2026-09-17 「이거 erp5 원자 처럼 하나하나 쪼개서 파이어스토어에 넣어야지」
 *
 * 원천 : `freepasserp5` / `settlement_rows` 461줄 (읽기만)
 * 대상 : `freepasserp5` / `settlement_atoms`  ★새 컬렉션. 원본을 «덮지 않는다»
 *
 * 무엇을 고쳐서 넣나 (docs/dev/LEDGER-ITEMS.md §2) —
 *   ① 요율 칸에 정액이 섞여 있다 → FeeBasis 로 갈라 담고 판정을 줄에 남긴다
 *   ② 청구 0 이 「청구 안 함」인지 「모름」인지 갈린다 → 끝난 줄의 0 만 사실로 둔다
 *   ③ 차량가액 0 을 「0원짜리 차」로 읽지 않는다
 *
 * ★멱등이다 — 문서 id 가 `code` 라 두 번 돌려도 줄이 두 배가 안 된다.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { toSettlementRow } from '../src/adapters/erp5/to-settlement.ts';
import { blockOf, isOpenIntake, isPerformance, margin } from '../src/domain/settlement/types.ts';

const has = (k: string) => process.argv.includes(k);
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APPLY = has('--apply');
const SA = arg('--sa', 'C:/dev/freepasserp4-rtdb-current/tmp/firebase-auth/freepasserp5-sa.json');
const SRC = arg('--src', 'settlement_rows');
const DST = arg('--dst', 'settlement_atoms');
const REPORT = arg('--report', 'docs/dev/evidence/LEDGER-ATOMIZE.md');

if (DST === SRC) throw new Error('★원본을 덮으려 한다. 대상이 원천과 같다.');

const sa = JSON.parse(readFileSync(SA, 'utf8'));
if (sa.project_id !== 'freepasserp5') throw new Error(`★ERP5 가 아니다: ${sa.project_id}`);
const db = getFirestore(initializeApp({ credential: cert(sa), projectId: sa.project_id }, 'atomize'));

const won = (x: number | null) => x === null ? '모름' : Math.round(x).toLocaleString('ko-KR');
const snapshotId = `stl-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;

console.error(APPLY ? '■ ★실제로 쓴다 (--apply)' : '■ 헛돌기 — 아무것도 안 쓴다 (--apply 를 붙이면 쓴다)');
console.error(`  ${sa.project_id} / ${SRC} → ${DST}`);

const docs = (await db.collection(SRC).get()).docs;
console.error(`  읽은 줄 ${docs.length}`);

type Out = ReturnType<typeof toSettlementRow>['row'] & {
  block: ReturnType<typeof blockOf>; warnings: string[];
  atomizedAt: string; snapshotId: string; sourceDocId: string;
};
const out: Out[] = [];
const held: { id: string; why: string }[] = [];
const warnCount = new Map<string, number>();

for (const d of docs) {
  const { row, warnings } = toSettlementRow(d.data(), d.id);
  for (const w of warnings) warnCount.set(w.slice(0, 26), (warnCount.get(w.slice(0, 26)) ?? 0) + 1);
  /* ★버리지 않는다 — 열쇠가 없으면 «보류함» 에 넣고 까닭을 남긴다 */
  if (!row.plate || !row.receivedAt) {
    held.push({ id: row.id, why: !row.plate ? '차량번호 없음' : '접수일 없음' });
  }
  out.push({ ...row, block: blockOf(row), warnings, atomizedAt: new Date().toISOString(), snapshotId, sourceDocId: d.id });
}

/* ★등식 — 읽은 줄 = 실은 줄. 조용히 사라진 것이 있나 */
const balanced = out.length === docs.length;
const live = out.filter((r) => !r.progress.cancelled);
const sum = (a: Out[], f: (r: Out) => number | null) => a.reduce((n, r) => n + (f(r) ?? 0), 0);
const unk = (a: Out[], f: (r: Out) => number | null) => a.filter((r) => f(r) === null).length;
const tally = (t: string, a: Out[]) =>
  `${t.padEnd(16)} ${String(a.length).padStart(4)}줄  청구 ${won(sum(a, (r) => r.money.claim)).padStart(13)}`
  + `${unk(a, (r) => r.money.claim) ? ` (모름 ${unk(a, (r) => r.money.claim)})` : ''}`
  + `  지급 ${won(sum(a, (r) => r.money.pay)).padStart(13)}  남는 것 ${won(sum(a, margin)).padStart(12)}`;

const byBlock: Record<string, number> = {};
for (const r of live) { const k = r.block ?? '끝'; byBlock[k] = (byBlock[k] ?? 0) + 1; }
const fee = {
  RATE: out.filter((r) => r.supplierFee.mode === 'RATE').length,
  FLAT: out.filter((r) => r.supplierFee.mode === 'FLAT').length,
  UNKNOWN: out.filter((r) => r.supplierFee.mode === 'UNKNOWN').length,
};

const lines = [
  `읽은 줄 ${docs.length} = 실은 줄 ${out.length}  → ${balanced ? '맞는다 ✓' : '★안 맞는다'}`,
  `보류함 ${held.length}줄 (버리지 않고 열쇠 없음으로 표시만 한다)`,
  '',
  tally('전체(취소 뺀)', live),
  tally('★현재 접수', out.filter(isOpenIntake)),
  tally('실적(인도됨)', out.filter(isPerformance)),
  '',
  '무엇에 막혀 있나 — ' + Object.entries(byBlock).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '),
  `수수료 꼴 — 비율 ${fee.RATE} · ★정액 ${fee.FLAT} · 모름 ${fee.UNKNOWN}`,
  '',
  '경고',
  ...[...warnCount].sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ⚠ ${k.padEnd(28)} ${v}`),
];
console.error('\n' + lines.join('\n'));

if (!balanced) { console.error('\n★등식이 안 맞아 «쓰지 않는다».'); process.exit(1); }

if (APPLY) {
  console.error(`\n■ ${DST} 에 쓴다 …`);
  let n = 0;
  for (let i = 0; i < out.length; i += 400) {
    const batch = db.batch();
    for (const r of out.slice(i, i + 400)) batch.set(db.collection(DST).doc(r.id), r, { merge: false });
    await batch.commit();
    n += Math.min(400, out.length - i);
    console.error(`   ${n} / ${out.length}`);
  }
  /* ★쓴 것을 «다시 읽어» 센다. 썼다고 믿지 않는다 */
  const back = (await db.collection(DST).count().get()).data().count;
  console.error(`■ 되읽어 센 줄 ${back} / 쓴 줄 ${out.length} → ${back === out.length ? '맞는다 ✓' : '★안 맞는다'}`);
  lines.push('', `쓴 뒤 되읽어 센 줄 ${back} / ${out.length}`);
} else {
  console.error('\n■ 안 썼다. 쓰려면 --apply');
}

mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT,
  `# 정산 실적 원자화 — ${APPLY ? '실행' : '헛돌기'}\n\n`
  + `| | |\n|---|---|\n| 때 | ${new Date().toISOString()} |\n| 스냅샷 | \`${snapshotId}\` |\n`
  + `| 원천 | \`${sa.project_id}\` / \`${SRC}\` |\n| 대상 | \`${DST}\` ${APPLY ? '' : '(안 씀)'} |\n\n`
  + '```\n' + lines.join('\n') + '\n```\n', 'utf8');
console.error(`■ 적었다 → ${REPORT}`);
