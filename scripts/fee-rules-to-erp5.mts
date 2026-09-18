/**
 * **수수료 규칙을 ERP5 SSOT 에 «원자» 로 박는다.**
 *
 *   npx tsx scripts/fee-rules-to-erp5.mts            ← 헛돌기: 규칙을 세고, 원장 전체를 그 규칙으로 «검산» 만 한다
 *   npx tsx scripts/fee-rules-to-erp5.mts --apply    ← ERP5 에 쓴다
 *
 * ★대표 2026-09-18 「수수료 계산하는 방식이랑 이런것들 다 학습해서 원자로 갖고와 … ssot에 반영되어야할거」
 *
 * ── 어디서 오나
 *   erp4 `lib/domain/settlement-fee-table.ts` — 수수료표 «정본»(박태윤 매니저가 정한 표 · 시트 「수수료표」 탭은 그 사본).
 *   ★손으로 옮겨 적지 않고 그 파일을 «그대로 읽는다». 사본을 두 번 만들면 둘이 갈린다.
 *
 * ── 어디로 가나 (ERP5 · 새 컬렉션 · 덧칠만)
 *   settlement_fee_rules/{id}      한 규칙 = 한 문서 (공급사 · 갈래 · 형태 · 기간 · 셈법 · 청구 · 지급 · 시점 · 자동 여부)
 *   settlement_rules/current       갈래 가르기(kindRules) · 이름 별칭 · 전기차 판정 · 청구·지급 시점 · 판(version)
 *
 * ★RTDB 없음. 기존 문서를 지우지 않는다. 같은 id 로 다시 쓰면 같은 값이 된다(멱등).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { FieldValue } from 'firebase-admin/firestore';
import { FEE_RULES, FEE_TIMING, SUPPLIER_ALIAS, EV_MODEL } from 'file:///C:/dev/freepasserp4/lib/domain/settlement-fee-table.ts';
import { erp5 } from '../src/adapters/erp5/firestore';
import { toSettlementRow } from '../src/adapters/erp5/to-settlement';
import { feeOf, headOf, type FeeRule, type FeeRuleSet, type KindRule } from '../src/domain/settlement/fee';

const APPLY = process.argv.includes('--apply');
const SOURCE = 'erp4 lib/domain/settlement-fee-table.ts (bf471b86 · 2026-09-08) — 박태윤 매니저 표';
const VERSION = 'fee-2026-09-08';
/**
 * ★이 표는 «지금» 규칙이다 — 검산(2026-09-18): 지난 달 줄은 그때 요율로 적혀 있다
 *   (1월 오플 전기차 100만 = 프로모션 전 · 오플 구독 73.2만 = 옛 요율 · 분납이 부러진 줄은 받은 회차만큼).
 *   ⇒ 지난 달은 «적힌 금액» 이 정본이다. 이 표로 지난 줄을 다시 세어 덮지 않는다.
 */
const EFFECTIVE = '2026-09-08 기준 현행 — 새 접수에 쓴다. 지난 달 줄은 원장에 적힌 금액이 정본(덮지 않는다)';

/**
 * 갈래 가르기 — erp4 `feeKindOf` 의 차례를 «데이터» 로 편 것. 위에서부터 처음 맞는 줄.
 * ★차례가 뜻이다: 「매칭출고」 가 먼저, 「신차발주」 는 선출고로 안 보낸다(사장님 2026-09-08 「신차발주는 주는 대로」).
 */
const KIND_RULES: KindRule[] = [
  { match: '견적출고|매칭출고', kind: '신차', form: '매칭출고' },
  { match: '신차발주', kind: '신차', form: '발주' },
  { match: '선발주', kind: '신차', form: '선발주', evKind: '전기차', evFallback: '신차' },
  { match: '선출고', kind: '신차', form: '선출고', evKind: '전기차', evFallback: '신차' },
  { match: '구독', kind: '구독', evKind: '전기차', evFallback: '구독' },
];

const idOf = (r: { supplier: string; kind: string; form: string; term: number }) =>
  `${headOf(r.supplier) || r.supplier}_${r.kind}_${r.form || '기본'}_${r.term}`.replace(/[/]/g, '·');

/**
 * ★`seq` = 표의 차례. 규칙 찾기가 «처음 맞는 것» 을 고르므로 차례가 뜻이다 —
 *   ERP5 는 문서를 id 순(가나다)으로 돌려줘 「매칭출고」 가 「선출고」 보다 앞에 선다.
 *   실측 2026-09-18: 차례 없이 읽으니 6줄이 다른 규칙으로 셈해졌다. 읽는 쪽은 seq 로 다시 줄 세운다.
 */
const rules: (FeeRule & { seq: number })[] = (FEE_RULES as Omit<FeeRule, 'id'>[]).map((r, seq) => ({ id: idOf(r), seq, ...r }));
const set: FeeRuleSet = { rules, aliases: SUPPLIER_ALIAS, evModel: EV_MODEL.source, kindRules: KIND_RULES, version: VERSION };

/* ── 검산 — 이 규칙으로 원장을 다시 세면 적힌 금액과 맞나 (erp4 check-fee-consistency 와 같은 잣대) ── */
const db = erp5();
const snap = await db.collection('settlement_rows').get();
type Tally = { ok: number; diff: number; manual: number; none: number; nobase: number };
const byMonth = new Map<string, Tally>();
const diffs: string[] = [];
const nones = new Map<string, number>();
const N = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s원]/g, '')); return Number.isFinite(n) ? n : 0; };
for (const d of snap.docs) {
  const raw = d.data();
  const { row: r } = toSettlementRow(raw, d.id);
  if (r.progress.cancelled) continue;
  const m = r.progress.billMonth ?? '(청구월 빈)';
  const t = byMonth.get(m) ?? { ok: 0, diff: 0, manual: 0, none: 0, nobase: 0 };
  byMonth.set(m, t);
  /* ★정산조건이 먼저 — 「영업」만·제외·보류는 공급사 청구가 0 (erp4 2026-09-02 박지원 사고) */
  const zero = r.settleTarget === '영업' || r.progress.settleExclude || r.progress.billHold;
  const ratio = r.settleRatio || 1;
  const written = zero ? 0 : Math.round(N(raw.claimWritten) * ratio);
  const f = feeOf(set, r);
  if (f.status === 'NO_RULE') { t.none += 1; nones.set(`${r.supplier ?? '(없음)'} · ${r.product ?? ''}`, (nones.get(`${r.supplier ?? '(없음)'} · ${r.product ?? ''}`) ?? 0) + 1); continue; }
  if (f.status === 'MANUAL') { t.manual += 1; continue; }
  if (f.status === 'NO_BASE') { t.nobase += 1; continue; }
  const want = zero ? 0 : Math.round(f.claim * ratio);
  if (Math.abs(written - want) < 2) { t.ok += 1; continue; }
  t.diff += 1;
  if (diffs.length < 40) diffs.push(`   ${String(r.plate ?? '').replace(/^(\d+\D)\d+/, '$1**').padEnd(9)} ${m} ${String(r.supplier).padEnd(8)} ${f.rule.kind}${f.rule.term ? ` ${f.rule.term}개월` : ''}${f.rule.form ? ` ${f.rule.form}` : ''}  적힌 ${written.toLocaleString()} · 표 ${want.toLocaleString()} · 차 ${(written - want).toLocaleString()}`);
}

const L: string[] = [];
const p = (s = '') => L.push(s);
p(`■ 수수료 규칙 → ERP5 ${APPLY ? '★실제로 씀' : '— 헛돌기(아무것도 안 씀)'}`);
p(`  출처 ${SOURCE}`);
p(`  규칙 ${rules.length}줄 · 공급사 ${new Set(rules.map((r) => r.supplier)).size}곳 · 기계가 셈 ${rules.filter((r) => r.auto).length} · 사람이 정함 ${rules.filter((r) => !r.auto).length}`);
p(`  갈래 가르기 ${KIND_RULES.length}줄 · 이름 별칭 ${Object.keys(SUPPLIER_ALIAS).length} · 시점 규칙 ${FEE_TIMING.length}`);
p('');
p('── 검산: 이 규칙으로 원장(취소 뺌)을 다시 세면 — 표대로 / 표와 다름 / 사람이 정함 / 표에 없음 / 밑값 없음');
const tot: Tally = { ok: 0, diff: 0, manual: 0, none: 0, nobase: 0 };
for (const [m, t] of [...byMonth].sort()) {
  p(`   ${m.padEnd(12)} ${String(t.ok).padStart(4)} ${String(t.diff).padStart(4)} ${String(t.manual).padStart(4)} ${String(t.none).padStart(4)} ${String(t.nobase).padStart(4)}`);
  for (const k of Object.keys(tot) as (keyof Tally)[]) tot[k] += t[k];
}
p(`   ${'합'.padEnd(12)} ${String(tot.ok).padStart(4)} ${String(tot.diff).padStart(4)} ${String(tot.manual).padStart(4)} ${String(tot.none).padStart(4)} ${String(tot.nobase).padStart(4)}`);
if (diffs.length) { p(''); p('── 표와 다른 줄 (앞 40) — ★규칙이 틀린 게 아니라 «그 줄에 사람이 다르게 적은 것» 일 수 있다. 원장은 안 고친다'); L.push(...diffs); }
if (nones.size) { p(''); p('── 표에 없는 공급사·갈래'); for (const [k, n] of [...nones].sort((a, b) => b[1] - a[1])) p(`   ${String(n).padStart(3)}  ${k}`); }

/* ── 쓴다 ── */
if (APPLY) {
  const now = Date.now();
  const 묶음 = <T,>(xs: T[], n = 400) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  let n = 0;
  for (const b of 묶음(rules)) {
    const w = db.batch();
    for (const r of b) w.set(db.collection('settlement_fee_rules').doc(r.id), { ...r, note: r.note ?? '', source: SOURCE, version: VERSION, effective: EFFECTIVE, updatedAt: now, _at: FieldValue.serverTimestamp() });
    await w.commit(); n += b.length;
  }
  await db.collection('settlement_rules').doc('current').set({
    version: VERSION, source: SOURCE, effective: EFFECTIVE, updatedAt: now,
    ruleCount: rules.length,
    kindRules: KIND_RULES,
    aliases: SUPPLIER_ALIAS,
    evModel: EV_MODEL.source,
    timing: FEE_TIMING,
    /** 사람이 읽는 규칙 — 셈은 코드가 하지만 «무엇을 셈하나» 는 여기 적힌다 */
    notes: {
      month: '박힌 청구월 > 분납은 접수월+(회차−1) > 일시납은 인도월 > 인도 전은 접수월(예정) — erp4 settlementMonthOf',
      money: '청구 = (claimWritten + claimIncentive) × settleRatio + claimAdjust · 정산대상 「영업」·정산제외·청구보류면 0 / 지급 = (payWritten + payIncentive) × settleRatio + payAdjust · 「공급」·제외면 0 — erp4 claimOf/payOf + 가감(대표 2026-09-18)',
      promotion: '프로모션 = 공급사가 더 주는 돈(claimIncentive) + 그중 영업자 몫(payIncentive = 금액 × promoShare · 기본 100% · 대표 2026-09-17) · 사유 promoReason',
      adjust: '가감 = 이 건만 ±(claimAdjust · payAdjust) · 사유 adjustReason 필수 · 비율 안 곱함 · 청구서 나간 줄/지급 끝난 줄은 못 바꿈(다음 달 이월). supplierFixAmt(정정금액)는 가감이 아니다',
      forward: '새 접수는 이 수수료표대로 셈한다(대표 2026-09-18 「앞으로는 수수료 대로 계산」) — 표가 못 내는 건(건별 책정·표에 없음)은 0 + 까닭',
      clawback: '환수는 접수 줄의 체크가 아니라 settlement_clawbacks 의 «반대 부호 한 줄» — 그 달·그 상대에서 뺀다',
      manual: 'auto=false 규칙(건별 책정·최대 9%·구독료+정액·조건분기)은 기계가 금액을 내지 않는다 — 적힌 금액이 정본',
    },
  }, { merge: false });
  p(''); p(`★썼다 — settlement_fee_rules ${n}문서 · settlement_rules/current 1문서`);
} else { p(''); p('★헛돌기다 — 아무것도 안 썼다. 쓰려면 --apply'); }

const 글 = L.join('\n');
console.log(글);
mkdirSync('docs/dev/evidence', { recursive: true });
const f = `docs/dev/evidence/fee-rules-to-erp5-${APPLY ? 'APPLY' : 'dryrun'}-${new Date().toISOString().slice(0, 10)}.md`;
writeFileSync(f, '```\n' + 글 + '\n```\n', 'utf8');
console.log(`\n적어 둔 곳: ${f}`);
