/**
 * **청구 전 줄의 «빈» 수수료를 ERP5 수수료표로 채운다.**
 *
 *   npx tsx scripts/fee-fill-erp5.mts            ← 헛돌기
 *   npx tsx scripts/fee-fill-erp5.mts --apply    ← 쓴다
 *
 * ★대표 2026-09-18 「그리고 그 수수료 대로 계산하면 되고」
 *
 * ── 무엇을 채우나 (덧칠만 — 적힌 값은 안 덮는다)
 *   ① 청구 전(billed 아님 · 청구 단계 「접수」 · 취소 아님) 이고
 *   ② 규칙이 기계로 셀 수 있는(AUTO) 줄 중
 *      A. 청구·지급이 둘 다 비었다                 → 둘 다 표대로
 *   ✕ (뺐다) 청구만 비고 지급이 표와 같은 줄 — 실측 5줄이 «전부 5월» 이었다. 대표 2026-09-17 「5월은 이미 다 한거고」:
 *     그 달의 청구 0 은 «처리 끝» 이다. 채우면 한 번 더 청구한다. 사람이 본다.
 *
 * ── 무엇을 안 채우나
 *   · 이미 다른 금액이 적힌 줄 — ★erp4 엔진 규칙 「수수료율은 계약시점 동결」.
 *     실측 2026-09-18: 2025-11~2026-01 오플구독이 732,000(옛 요율) — 현행 표(1,000,000)로 덮으면 건당 268,000 을 더 청구한다.
 *   · 청구서가 나간 줄 — 나간 종이와 원장이 갈린다
 *   · 사람이 정하는 규칙 · 표에 없음 · 밑값 없음
 *
 * ★채울 때마다 settlement_events 에 이력(칸 · 전 · 후 · 규칙)을 남긴다. RTDB 없음.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { erp5 } from '../src/adapters/erp5/firestore';
import { toSettlementRow } from '../src/adapters/erp5/to-settlement';
import { loadFeeRuleSet } from '../src/adapters/erp5/fee-rules';
import { feeOf } from '../src/domain/settlement/fee';
import { intakeEventDocId } from '../src/domain/settlement/code';
import { assertErp5MaintenanceWrite } from '../src/shared/erp5-write-approval';

const APPLY = process.argv.includes('--apply');
assertErp5MaintenanceWrite(process.env, APPLY, 'fee-fill-erp5');
const N = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s원]/g, '')); return Number.isFinite(n) ? n : 0; };
const mask = (p: unknown) => String(p ?? '').replace(/^(\d+\D)\d+/, '$1**');
const audId = () => { const A = '23456789abcdefghjkmnpqrstuvwxyz'; let t = ''; for (let i = 0; i < 10; i += 1) t += A[Math.floor(Math.random() * A.length)]; return `aud_${t}`; };

const db = erp5();
const set = await loadFeeRuleSet(0);
const snap = await db.collection('settlement_rows').get();

type Fill = { id: string; auditEventId: string; patch: Record<string, unknown>; events: { field: string; from: string; to: string }[]; line: string };
const fills: Fill[] = [];
const keep: string[] = [];
let open = 0;
for (const d of snap.docs) {
  const raw = d.data();
  const { row: r } = toSettlementRow(raw, d.id);
  if (r.progress.cancelled || r.progress.billed || r.claimStage !== '접수') continue;
  open += 1;
  const f = feeOf(set, r);
  if (f.status !== 'AUTO') continue;
  const wc = N(raw.claimWritten), wp = N(raw.payWritten);
  if (wc === f.claim && wp === f.pay) continue;
  const tag = `${set.version} · ${f.rule.id}`;
  if (!wc && !wp) {
    fills.push({
      id: d.id,
      auditEventId: String(raw.auditEventId ?? '').trim() || intakeEventDocId(
        raw.plate, raw.sourceProductId, raw.receivedAt, raw.intakeRequestId, raw.intakeIdentityMode,
      ),
      patch: { claimWritten: f.claim, payWritten: f.pay, supplierRate: f.rule.claim, agentRate: f.rule.pay },
      events: [{ field: '청구금액', from: '0', to: String(f.claim) }, { field: '지급액', from: '0', to: String(f.pay) }],
      line: `   A ${mask(raw.plate).padEnd(9)} ${String(raw.receivedAt)} ${String(r.supplier).padEnd(7)} ${r.product}  청구 ${f.claim.toLocaleString()} · 지급 ${f.pay.toLocaleString()}  [${f.rule.id}]`,
    });
    continue;
  }
  if (!wc && wp === f.pay) {
    keep.push(`   청구만 빈칸 ${mask(raw.plate).padEnd(9)} ${String(raw.receivedAt)} ${String(r.supplier).padEnd(7)} ${r.product}  지급 ${wp.toLocaleString()} (표와 같음) · 표 청구 ${f.claim.toLocaleString()} — ★5월 청구 0 은 «처리 끝» 일 수 있다  [${f.rule.id}]`);
    continue;
  }
  keep.push(`   ${mask(raw.plate).padEnd(9)} ${String(raw.receivedAt)} ${String(r.supplier).padEnd(7)} ${r.product}  적힌 ${wc.toLocaleString()}/${wp.toLocaleString()} · 표 ${f.claim.toLocaleString()}/${f.pay.toLocaleString()}  [${f.rule.id}]`);
}

const L: string[] = [];
L.push(`■ 수수료표로 빈 금액 채우기 ${APPLY ? '★실제로 씀' : '— 헛돌기'} · 표 ${set.version}`);
L.push(`  청구 전 줄 ${open} · 채울 줄 ${fills.length} · 표와 다른데 «안 덮는» 줄 ${keep.length}`);
L.push('', '── 채울 줄 (청구·지급 둘 다 빈칸)', ...fills.map((x) => x.line));
L.push('', '── ★안 채우는 줄 — 계약시점 요율이 적혀 있거나(동결) · 5월 청구 0(처리 끝일 수 있음). 사람이 정한다', ...keep);

if (APPLY && fills.length) {
  const now = Date.now();
  const chunks = <T,>(xs:T[], size=200) => Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, (i + 1) * size));
  for (const batchRows of chunks(fills)) {
    const w = db.batch();
    for (const x of batchRows) {
      w.update(db.collection('settlement_rows').doc(x.id), {
        ...x.patch, auditEventId: x.auditEventId, updatedAt: now,
        _fee: { version: set.version, at: new Date(now).toISOString(), by: 'freepass-admin:fee-fill' },
      });
      const ev: Record<string, unknown> = {};
      for (const e of x.events) ev[audId()] = { at: now, by: 'freepass-admin:fee-fill', ...e };
      w.set(db.collection('settlement_events').doc(x.auditEventId), ev, { merge: true });
    }
    await w.commit();
  }
  L.push('', `★썼다 — ${fills.length}줄 · 이력 남김`);
} else L.push('', APPLY ? '채울 것이 없다' : '★헛돌기 — 쓰려면 --apply');

const 글 = L.join('\n');
console.log(글);
mkdirSync('docs/dev/evidence', { recursive: true });
writeFileSync(`docs/dev/evidence/fee-fill-erp5-${APPLY ? 'APPLY' : 'dryrun'}-${new Date().toISOString().slice(0, 10)}.md`, '```\n' + 글 + '\n```\n', 'utf8');
