/**
 * **F04 시트에만 있는 값을 ERP5 SSOT 에 «덧칠» 한다.**
 *
 *   npx tsx scripts/f04-fill-erp5.mts                 ← ★헛돌기. 아무것도 안 쓴다 (기본)
 *   npx tsx scripts/f04-fill-erp5.mts --apply         ← 실제로 쓴다 — ★새 줄만 (대표 확인 뒤에만)
 *   npx tsx scripts/f04-fill-erp5.mts --apply --fill  ← 있는 줄의 빈 칸까지 (대표가 따로 말할 때만)
 *
 * ★대표 2026-09-18
 *   「너는 erp5 ssot를 «직접» 읽는거야. 상품이랑 정산도 다 여기서 관리할거야」
 *   「f04 내용을 한번 ssot에 넣어서 f04는 «참고만» 하는 자료로 쓸거라고」
 *   「정산도 이어서 할수 있게끔 구글시트 데이터는 erp5에 파이어스토어에 «다 있어야함»」
 *   ★★「f04는 «계속 유지»하면서 같이 입력할거야」 · 「당분간은 f04랑 erp입력을 «병행»할거임」
 *   ⇒ 한 번 옮기고 끝나는 도구가 «아니다». 병행 기간 내내 «되풀이해» 돌린다.
 *     시트에 새로 적힌 줄·빈 칸을 ERP5 에 얹는다. ERP5 에 든 값은 시트가 못 바꾼다.
 *
 * ── ★★같은 접수가 «두 줄» 로 서면 안 된다 (병행의 제일 큰 구멍)
 *   시트에도 적고 ERP 에도 적는다 ⇒ 같은 계약이 양쪽에서 들어온다.
 *   - 맞추는 열쇠는 «차번 + 접수일» (ERP5 찾는 열쇠 · 시트도 같은 말)
 *   - 새로 세울 때 문서 id 는 ERP5 코드 규격 `stl_` + «결정» 토큰이다
 *     (erp4 `lib/domain/ids.ts` `stableId('settlement', 차번|접수일)` 과 같은 셈법 — SHA-256 → 31자 알파벳).
 *     ⇒ 몇 번을 돌려도 같은 id 다. `code` 칸에도 같은 값을 박는다(실측 461/461 이 code == id).
 *   ⚠ ERP 화면에서 먼저 넣은 줄은 id 가 무작위라도 «열쇠» 로 붙는다 — 그래서 두 줄이 안 선다.
 *     단, 차번·접수일을 «다르게» 적으면 못 붙는다. 그건 사람이 맞춰야 하므로 «어긋남» 으로 알린다.
 *
 * ── 이관은 «이미 대부분» 돼 있다 (실측 2026-09-18)
 *   ERP5 `settlement_rows` 461줄의 `fromSheet` 가 「접수 + 완납실적 + 분납실적」 — F04 탭 이름 그대로다.
 *   청구·지급도 이미 있다(이름만 다르다: claim→claimWritten · pay→payWritten).
 *   ⇒ 이 스크립트는 «옮기기» 가 아니라 «빈 자리 메우기» 다.
 *
 * ── ★★덧칠만 한다 — 덮지 않는다
 *   ERP5 에 이미 값이 있는 칸은 «한 글자도» 안 바꾼다. 시트와 달라도 안 바꾼다.
 *   (대조표 2026-09-18: 겹친 칸 일치 99.9% — 어긋난 6곳은 전부 `note` 였고 둘 다 사실이었다.
 *    한쪽을 버리면 «왜 그 금액이 됐는지» 를 잃는다.)
 *   ⇒ 이미 든 값 위에 시트 값을 덮는 사고가 «구조적으로» 안 나게 한다.
 *
 * ── 세 갈래
 *   ① 겹친 줄   ERP5 에 «칸이 없거나 비어 있는» 자리만 채운다
 *   ② 시트에만   ERP5 에 없는 줄 — 새로 세운다. 문서 id 는 `stl_{결정 토큰}` (멱등)
 *   ③ 보류      차번이 없어 못 맞춘 줄 — `settlement_held` 에 «원문 그대로» 둔다. 버리지 않는다
 *
 * ★멱등이다 — 두 번 돌려도 줄이 두 배가 안 되고, 두 번째는 «바꿀 것 0» 이 나와야 한다.
 * ★RTDB 는 쓰지 않는다 (2026-09-14 폐기). 원천 F04 시트에는 «절대» 쓰지 않는다 — 읽기만.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { intakeRecord } from '../src/domain/settlement/intake';
import { intakeEventDocId, settlementCode, settlementKey } from '../src/domain/settlement/code';
import { f04SettlementField } from '../src/adapters/f04/sheet.ts';
import path from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
/**
 * ★★대표 2026-09-18 「있으면 안 올리면 되잖아 같은거는」
 *   ⇒ 기본은 «새 줄만» 올린다. ERP5 에 이미 있는 줄은 «한 칸도» 안 건드린다(빈 칸도 안 채운다).
 *   빈 칸 메우기는 `--fill` 을 따로 붙였을 때만 한다 — 대표가 따로 말하기 전에는 안 쓴다.
 */
const FILL = process.argv.includes('--fill');
const SA = 'C:/dev/freepasserp4-rtdb-current/tmp/firebase-auth/freepasserp5-sa.json';
const ROWS = 'settlement_rows';
const EVENTS = 'settlement_events';
const HELD = 'settlement_held';
const STAMP = new Date().toISOString();
const RUN = `f04fill-${STAMP.replace(/[-:T]/g, '').slice(0, 14)}`;

const sa = JSON.parse(readFileSync(SA, 'utf8'));
if (sa.project_id !== 'freepasserp5') throw new Error(`★ERP5 가 아니다: ${sa.project_id}`);
const db = getFirestore(initializeApp({ credential: cert(sa), projectId: sa.project_id }, 'fill'));

// eslint-disable-next-line no-eval
const F04 = eval(`${readFileSync('docs/ui/mockups/f04.ssot.js', 'utf8')};F04`);

/* ── 무엇을 옮기나 ─────────────────────────────────────────── */

/**
 * ★옮기지 «않는» 칸.
 *   claim · pay  — ERP5 가 `claimWritten` · `payWritten` 으로 이미 들고 있다(400/400 실측).
 *                  같은 값을 두 이름으로 두면 어느 쪽을 믿을지 모르게 된다.
 *   값이 0줄인 칸 — 시트에 칸만 있고 값이 없다. 빈 칸을 만들 뿐이다.
 */
const 안옮김 = new Set([
  'claim', 'pay',
  /**
   * ★★clawback — 옮기지 «않는다». 이 집 규칙이다(docs/ui/mockups/admin-shell.data.js PERFS 머리):
   *   「★★환수를 «접수의 체크» 로 달지 않는다. 체크로 달면 이미 선 실적을 나중에 손대게 되고,
   *     그 순간 원장이 더러워진다. 환수는 «반대 부호의 실적 한 줄» 이다」
   *   시트는 체크박스로 적지만, ERP5 는 이미 `settlement_clawbacks`(23건)로 «따로» 둔다.
   *   체크를 접수 줄에 붙이면 같은 사실이 두 곳에 두 꼴로 선다.
   */
  'clawback',
  /** fromTab — 우리 리더(f04-ssot.mts)가 붙인 꼬리표다. ERP5 의 sourceTab · fromSheet 와 겹친다. */
  'fromTab',
]);

const 빈 = (v: unknown) => v === null || v === undefined || v === '';
/**
 * 견줄 때만 쓰는 꼴 — 「1,000」 과 1000, true 와 "TRUE" 를 «같다» 고 본다.
 * ⚠ 글자 그대로 견주면 꼴만 다른 것까지 「다르다」 로 세어 1,186 이 나왔다(실측).
 *   대조표(f04-vs-erp5.mts)와 «같은 잣대» 를 쓴다 — 두 표가 다른 수를 말하면 안 된다.
 */
const 견줌 = (v: unknown): string => {
  if (typeof v === 'boolean') return v ? '1' : '0';
  const t = String(v ?? '').trim();
  if (/^(true|false)$/i.test(t)) return /^true$/i.test(t) ? '1' : '0';
  const n = Number(t.replace(/,/g, ''));
  if (t && /^[\d,.\-]+$/.test(t) && Number.isFinite(n)) return String(n);
  return t;
};
const 반듯 = (s: unknown) => String(s ?? '').replace(/\s/g, '');
const 열쇠 = (r: Record<string, unknown>) => settlementKey(r.plate, r.receivedAt);
/** 문서 id 에 못 쓰는 글자를 뺀다 — 멱등 id 가 매번 같아야 한다. */
const 안전id = (s: string) => s.replace(/[/#.$\[\]\s|]/g, '_');
/**
 * ★시트 사진이 묵었으면 «쓰지 않는다». 병행 중에는 시트가 계속 바뀐다 —
 *   묵은 사진으로 쓰면 그 사이 적힌 줄을 «없다» 고 보고 넘어간다.
 */
const 사진때 = String(F04.report?.readAt ?? '');
const 사진나이분 = 사진때 ? Math.round((Date.now() - Date.parse(사진때)) / 60000) : Infinity;
if (APPLY && !(사진나이분 <= 60)) {
  console.error(`✕ 시트 사진이 ${사진나이분}분 묵었다(${사진때 || '때 모름'}). 먼저 다시 찍는다:  npx tsx scripts/f04-ssot.mts`);
  process.exit(1);
}

/* ── 읽는다 ───────────────────────────────────────────────── */
console.error(`■ ${APPLY ? '★실제로 쓴다' : '헛돌기 — 아무것도 안 쓴다'} · ${RUN}`);
const snap = await db.collection(ROWS).get();
const E = new Map<string, { id: string; data: Record<string, unknown> }>();
/** ★ERP5 안에서 이미 «열쇠가 겹친» 줄 — 병행 입력이 낳는 바로 그 사고다. 고치지 않고 알린다. */
const 겹친열쇠 = new Map<string, string[]>();
const 미래접수: string[] = [];
const 오늘 = STAMP.slice(0, 10);
for (const d of snap.docs) {
  const k = 열쇠(d.data());
  /** 차번 없는 줄(업무지원비 등)은 열쇠가 «접수일뿐» 이라 겹쳐 보인다 — 겹침이 아니다. */
  if (E.has(k) && 반듯(d.data().plate)) 겹친열쇠.set(k, [...(겹친열쇠.get(k) ?? [E.get(k)!.id]), d.id]);
  else E.set(k, { id: d.id, data: d.data() });
  if (String(d.data().receivedAt ?? '').slice(0, 10) > 오늘) 미래접수.push(d.id);
}
const 있던보류 = new Set((await db.collection(HELD).get()).docs.map((d) => d.id));

/* ── ① 겹친 줄 · ② 시트에만 ──────────────────────────────────── */
type 칸셈 = { 새칸: number; 빈칸메움: number };
const 칸별 = new Map<string, 칸셈>();
const 셈 = (c: string) => { if (!칸별.has(c)) 칸별.set(c, { 새칸: 0, 빈칸메움: 0 }); return 칸별.get(c)!; };

const 고칠것: { id: string; patch: Record<string, unknown> }[] = [];
const 새줄: { id: string; data: Record<string, unknown>; auditEventId: string; auditKey: string }[] = [];
let 안바뀜 = 0, 달라도둠 = 0;
const 다른칸 = new Map<string, number>();

for (const f of F04.rows as Record<string, unknown>[]) {
  const k = 열쇠(f);
  const e = E.get(k);

  if (!e) {
    /* ② 시트에만 — 새로 세운다. ★어디서 왔는지 박는다
     *   ★기존 줄과 «같은 꼴» 로 세운다 — 2026-09-18 시트 칸만으로 세웠다가 10줄에 claimStage 등 50여 칸이 빠졌다
     *     (디자인 세션이 찾음 · scripts/settlement-shape-fill.mts 로 메움). 기본 꼴 위에 시트 값을 얹는다. */
    const base = intakeRecord({
      receivedAt: String(f.receivedAt ?? ''), plate: String(f.plate ?? ''), model: '', supplier: '', supplierCode: '', customer: '',
      channel: '', channelCode: '', agent: '', agentCode: '', product: '', rentKind: '', contractType: '', term: null, rent: null,
      deposit: null, price: null, payKind: '', paper: false, delivered: false, deliveredAt: '', note: '',
    }, Date.now());
    const data: Record<string, unknown> = { ...base, settleNote: '', fromSheet: 'F04 연동' };
    for (const [c, v] of Object.entries(f)) {
      if (빈(v) || 안옮김.has(c)) continue;
      data[f04SettlementField(c)] = v;
    }
    /** 청구·지급은 ERP5 이름으로 둔다 — 한 원장에 두 이름이 서면 안 된다 */
    if (!빈(f.claim)) data.claimWritten = f.claim;
    if (!빈(f.pay)) data.payWritten = f.pay;
    const id = settlementCode(data.plate, data.receivedAt);
    const auditEventId = intakeEventDocId(
      data.plate, data.sourceProductId, data.receivedAt, data.intakeRequestId, data.intakeIdentityMode,
    );
    const auditKey = 'aud_f04_' + createHash('sha256').update(`${id}|${RUN}`).digest('hex').slice(0, 16);
    data.code = id;
    data.auditEventId = auditEventId;
    data._f04 = { run: RUN, at: STAMP, tab: f.sourceTab ?? f.fromTab ?? null, row: f.sourceRow ?? null, created: true };
    새줄.push({ id, data, auditEventId, auditKey });
    continue;
  }

  /* ① 겹친 줄 — ★빈 자리만 */
  const patch: Record<string, unknown> = {};
  for (const [c, v] of Object.entries(f)) {
    if (빈(v) || 안옮김.has(c)) continue;
    const field = f04SettlementField(c);
    const 있던 = e.data[field];
    if (!(field in e.data)) { patch[field] = v; 셈(field).새칸++; continue; }
    if (빈(있던)) { patch[field] = v; 셈(field).빈칸메움++; continue; }
    /* ★이미 값이 있다 — 달라도 «안 건드린다». 세어만 둔다 */
    if (견줌(있던) !== 견줌(v)) { 달라도둠++; 다른칸.set(field, (다른칸.get(field) ?? 0) + 1); }
  }
  if (Object.keys(patch).length && FILL) {
    patch._f04 = { run: RUN, at: STAMP, tab: f.sourceTab ?? f.fromTab ?? null, row: f.sourceRow ?? null, filled: Object.keys(patch) };
    고칠것.push({ id: e.id, patch });
  } else if (!Object.keys(patch).length) 안바뀜++;
}

/* ── ③ 보류 ─────────────────────────────────────────────── */
/**
 * ★이미 둔 보류는 «다시 안 쓴다» — 되풀이해 돌려도 두 번째는 「바꿀 것 0」 이어야 한다.
 * ⚠ id 가 탭·행이라, 시트 위에 줄이 끼면 같은 보류가 다른 id 로 한 번 더 설 수 있다.
 *   보류는 «사람이 보고 정할 목록» 이지 원장이 아니므로 금액을 두 번 세지 않는다 — 그래도 알고 둔다.
 */
const 보류전부 = (F04.held as Record<string, unknown>[]).map((h, i) => ({
  id: 안전id(`${h.tab ?? 'tab'}_${h.row ?? i}`),
  data: { ...h, _f04: { run: RUN, at: STAMP, why: '차량번호가 없어 원장 줄과 맞출 수 없었다 — 「없다」가 아니라 「모른다」' } },
}));
const 보류 = 보류전부.filter((x) => !있던보류.has(x.id));

/* ── 보고 ─────────────────────────────────────────────── */
const L: string[] = [];
const p = (s = '') => L.push(s);
p(`■ F04 → ERP5 덧칠 ${APPLY ? '★실제로 씀' : '— 헛돌기(아무것도 안 씀)'}`);
p(`  ${RUN} · 시트 사진 ${사진때} (${사진나이분}분 전) · 시트 실은 줄 ${F04.rows.length} · 보류 ${F04.held.length} · ERP5 ${snap.size}줄`);
p('');
p('── 무엇이 바뀌나');
p(FILL
  ? `   ① 겹친 줄 중 «빈 자리를 채울» 줄   ${String(고칠것.length).padStart(4)}`
  : `   ① 이미 있는 줄 — ★안 올린다(건드리지 않음)   ${String(E.size && (F04.rows.length - 새줄.length))}`);
p(`      이미 다 차 있어 안 바뀌는 줄       ${String(안바뀜).padStart(4)}`);
p(`      ★값이 달라도 «안 건드린» 칸       ${String(달라도둠).padStart(4)}   ← 덮지 않는다`);
p(`   ② 시트에만 있어 «새로 세울» 줄       ${String(새줄.length).padStart(4)}`);
p(`   ③ 보류를 settlement_held 에 둘 줄   ${String(보류.length).padStart(4)}   (이미 둔 것 ${보류전부.length - 보류.length})`);
if (겹친열쇠.size || 미래접수.length) {
  p('');
  p('── ⚠ ERP5 안에서 사람이 봐야 할 것 — 고치지 않고 알린다');
  for (const [k, ids] of 겹친열쇠) p(`   같은 차번+접수일이 ${ids.length}줄   ${k.replace(/^(\d+\D)\d+/, '$1****')}   ${ids.join(' · ')}`);
  for (const id of 미래접수) p(`   접수일이 오늘 뒤다        ${id}`);
}
if (다른칸.size) {
  p('');
  p('── ★값이 달라 «안 건드린» 칸 — ERP5 값을 그대로 둔다');
  for (const [c, n] of [...다른칸].sort((a, b) => b[1] - a[1])) p(`   ${c.padEnd(16)}${String(n).padStart(5)}`);
}
p('');
p('── 옮기지 «않은» 칸');
p('   claim · pay   ERP5 가 claimWritten · payWritten 으로 이미 들고 있다');
p('   clawback      ★환수는 «접수의 체크» 가 아니라 «반대 부호의 한 줄» — ERP5 는 settlement_clawbacks 로 따로 둔다');
p('   fromTab       우리 리더의 꼬리표 — sourceTab · fromSheet 와 겹친다');
p('');
p('── 칸별 — 새 칸(ERP5 에 칸이 없었다) / 빈 칸 메움(칸은 있는데 비어 있었다)');
for (const [c, s] of [...칸별].sort((a, b) => (b[1].새칸 + b[1].빈칸메움) - (a[1].새칸 + a[1].빈칸메움))) {
  p(`   ${c.padEnd(16)}${String(s.새칸).padStart(6)}${String(s.빈칸메움).padStart(8)}`);
}
if (새줄.length) {
  p('');
  p('── 새로 세울 줄');
  for (const n of 새줄) p(`   ${n.id}   ${String(n.data.customer ?? '').slice(0, 1)}○○ · ${n.data.supplier ?? ''} · ${n.data.model ?? ''}`);
}
p('');
p(APPLY ? '★썼다.' : '★헛돌기다 — 아무것도 안 썼다. 쓰려면 --apply (대표 확인 뒤).');

/* ── 쓴다 (--apply 일 때만) ─────────────────────────────── */
if (APPLY) {
  /** 한 번에 500 이 Firestore 한도다. 넉넉히 400씩 */
  const 묶음 = <T,>(xs: T[], n = 400) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  let n = 0;
  for (const b of 묶음(고칠것)) {
    const w = db.batch();
    for (const x of b) w.set(db.collection(ROWS).doc(x.id), { ...x.patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await w.commit(); n += b.length;
  }
  /* 새 접수는 원장 + 최초 audit event를 같은 batch에 쓴다. 1줄당 2 write라 200개씩 묶어 500 한도를 넘지 않는다. */
  for (const b of 묶음(새줄, 200)) {
    const w = db.batch();
    for (const x of b) {
      w.set(db.collection(ROWS).doc(x.id), { ...x.data, createdAt: FieldValue.serverTimestamp() }, { merge: true });
      w.set(db.collection(EVENTS).doc(x.auditEventId), {
        [x.auditKey]: {
          at: Date.parse(STAMP),
          by: 'f04-import',
          field: '접수',
          from: '',
          to: x.id,
          source: 'F04',
          run: RUN,
        },
      }, { merge: true });
    }
    await w.commit(); n += b.length;
  }
  for (const b of 묶음(보류)) {
    const w = db.batch();
    for (const x of b) w.set(db.collection(HELD).doc(x.id), x.data, { merge: true });
    await w.commit(); n += b.length;
  }
  p(`   문서 ${n}개를 썼다.`);
}

const 글 = L.join('\n');
console.log(글);
const 낼곳 = path.join('docs', 'dev', 'evidence');
mkdirSync(낼곳, { recursive: true });
const 파일 = path.join(낼곳, `f04-fill-erp5-${APPLY ? 'APPLY' : 'dryrun'}-${STAMP.slice(0, 10)}.md`);
writeFileSync(파일, '```\n' + 글 + '\n```\n', 'utf8');
console.log(`\n적어 둔 곳: ${파일}`);
