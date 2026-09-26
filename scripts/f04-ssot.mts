/**
 * F04 정산원장 시트 «전체» 를 읽어 SSOT 스냅샷을 만든다. ★아무것도 안 쓴다.
 *
 *   npx tsx scripts/f04-ssot.mts
 *
 * ★대표 2026-09-17 「시트에 있는 모든 내용을 일단 SSOT화 하자」
 *
 * 담는 것(원자 — 사람이 적는 것) : 수수료표 · 실적 네 탭 · 정산 진행 · 차량대장 · _상품
 * 안 담는 것(파생 — 기계가 찍는 것) : 월 탭 · 요약 · 구버전  → ★대조에만 쓴다
 *
 * 갈래와 까닭 : docs/dev/F04-SSOT.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { JWT } from 'google-auth-library';
import {
  billMonthOf, cellDate, findHeader, methodOf, picker, feeValueOf, cellCheck, cellNumber, cellText,
} from '../src/adapters/f04/sheet.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LEDGER = arg('--id', '1BjGBqAjRLEb9ZMKarpQsMF-q_UjdgmEqBAl1uVk8SR4');
const SA = arg('--sa', 'C:/dev/freepasserp4/tmp/firebase-auth/sa.json');
const OUT = arg('--out', 'docs/ui/mockups/f04.ssot.js');
const REPORT = arg('--report', 'docs/dev/evidence/F04-SSOT-READ.md');

const sa = JSON.parse(readFileSync(SA, 'utf8'));
const jwt = new JWT({
  email: sa.client_email, key: sa.private_key, subject: 'pyh@teamjpk.com',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],   /* ★읽기만 한다 */
});
const api = async (u: string) => {
  const t = (await jwt.getAccessToken()).token;
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json() as Promise<any>;
};
const range = (tab: string, a1 = 'A1:CZ2000') =>
  encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${a1}`);
const values = async (tab: string) =>
  ((await api(`https://sheets.googleapis.com/v4/spreadsheets/${LEDGER}/values/${range(tab)}?valueRenderOption=UNFORMATTED_VALUE`)).values ?? []) as unknown[][];

const log: string[] = [];
const say = (s: string) => { console.error(s); log.push(s); };

const meta = await api(`https://sheets.googleapis.com/v4/spreadsheets/${LEDGER}?fields=properties.title,sheets.properties.title`);
const tabs: string[] = meta.sheets.map((s: any) => s.properties.title);
say(`■ ${meta.properties.title}`);
say(`  탭 ${tabs.length}개`);

/* ══ ① 수수료표 — ★셈법의 정본 ════════════════════════════ */
const feeRows = await values('수수료표');
const fh = findHeader(feeRows, '공급사');
if (fh < 0) throw new Error('★수수료표 머리글을 못 찾았다 — 말없이 넘어가지 않는다');
const fp = picker(feeRows[fh].map(String));
/* ★같은 탭에 표가 «둘» 있다 — 요율표 아래에 「청구·지급 시점」 규칙표가 붙어 있다.
   두 번째 머리글은 「누가 · 어떤 건 · 어떻게」 다. 거기서 끊는다. */
const secondHead = feeRows.findIndex((r, i) => i > fh && String(r?.[0] ?? '').trim() === '누가');
const feeBody = feeRows.slice(fh + 1, secondHead > 0 ? secondHead - 1 : undefined);
const timingRules = secondHead > 0
  ? feeRows.slice(secondHead + 1).filter((r) => cellText(r?.[0]))
      .map((r) => ({ who: cellText(r[0]), what: cellText(r[1]), how: cellText(r[2]) }))
  : [];
const feeTable = feeBody.filter((r) => cellText(r?.[0]))
  .map((r) => {
    const method = methodOf(fp.raw(r, '셈법'));
    return {
      supplier: fp.text(r, '공급사'), kind: fp.text(r, '갈래'), form: fp.text(r, '형태'),
      term: fp.text(r, '계약기간'), method,
      claimRaw: fp.text(r, '공급사에서 받을 것'), payRaw: fp.text(r, '영업채널에 줄 것'),
      claimRate: feeValueOf(fp.raw(r, '공급사에서 받을 것'), method),
      payRate: feeValueOf(fp.raw(r, '영업채널에 줄 것'), method),
      byMachine: String(fp.raw(r, '기계가 낼 수 있나') ?? '').trim() === '예',
      billWhen: fp.text(r, '청구 시점'), note: fp.text(r, '비고'),
    };
  });
const byMethod: Record<string, number> = {};
for (const f of feeTable) byMethod[f.method] = (byMethod[f.method] ?? 0) + 1;
say(`\n■ 수수료표 ${feeTable.length}줄 · 공급사 ${new Set(feeTable.map((f) => f.supplier)).size}곳`);
say(`  셈법 — ${Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
say(`  ★기계가 낸다 ${feeTable.filter((f) => f.byMachine).length} · 사람이 정한다 ${feeTable.filter((f) => !f.byMachine).length}`);
say(`
■ ★청구·지급 «시점» 규칙 ${timingRules.length}줄 — 요율과 «따로» 도는 규칙이다`);
for (const t of timingRules) say(`  ${(t.who ?? '').padEnd(12)} ${(t.what ?? '').padEnd(10)} ${t.how ?? ''}`);

/* ══ ② 실적 네 탭 — 54열이 «같은 규격» 이라 한 벌로 합친다 ══ */
const PERF_TABS = ['접수', '완납실적', '분납실적', '취소'] as const;
const NEED = ['차량번호', '접수일', '공급사', '영업채널', '청구년', '청구월', '판매수료'];
const rows: any[] = [];
const held: { tab: string; row: number; why: string }[] = [];
const readCount: Record<string, number> = {};
const missingCols: Record<string, string[]> = {};

for (const tab of PERF_TABS) {
  const raw = await values(tab);
  const hi = findHeader(raw, '차량번호');
  if (hi < 0) { say(`  ★「${tab}」 머리글을 못 찾았다 — 건너뛰지 않고 멈춘다`); throw new Error(`머리글 없음: ${tab}`); }
  const head = raw[hi].map((x) => String(x ?? '').trim());
  const p = picker(head);
  const miss = p.missing(['차량번호', '접수일', '공급사', '청구년', '청구월', '판매수수료', '출고수수료']);
  if (miss.length) missingCols[tab] = miss;
  const body = raw.slice(hi + 1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim()));
  readCount[tab] = body.length;

  body.forEach((r, i) => {
    const plate = p.text(r, '차량번호');
    const receivedAt = p.date(r, '접수일');
    /* ★버리지 않는다 — 열쇠가 없으면 보류함에 «까닭과 함께» */
    if (!plate) { held.push({ tab, row: hi + 2 + i, why: '차량번호 없음' }); return; }
    rows.push({
      /* 열쇠 */
      plate, receivedAt, fromTab: tab,
      /* 뼈대 */
      supplier: p.text(r, '공급사'), model: p.text(r, '모델명'),
      channel: p.text(r, '영업채널'), agent: p.text(r, '영업담당자'),
      agentCode: p.text(r, '영업자코드'), customer: p.text(r, '고객명'),
      /* 조건 */
      product: p.text(r, '상품구분'), rentKind: p.text(r, '렌트구분'),
      contractType: p.text(r, '계약형태'),
      term: p.num(r, '계약기간'), rent: p.num(r, '렌탈료'), deposit: p.num(r, '보증금'),
      price: p.num(r, '차량가액') || null,
      payKind: p.text(r, '분납여부'), paidRounds: p.num(r, '납입회차'),
      age: p.num(r, '연령'), region: p.text(r, '출고지역'),
      /* ★프로모션 — 접수할 때 넣는다 (대표 2026-09-17).
         「계약대여료」는 실제로 받는 값이고 「렌탈료」는 상품의 값이다.
         둘이 다르면 그 차액이 프로모션이거나 업셀링이다. */
      contractRent: p.num(r, '계약대여료'),
      upsell: p.num(r, '업셀링금액'),
      /* 진행 */
      paper: p.check(r, '계약서'), delivered: p.check(r, '인도완료'), deliveredAt: p.date(r, '인도일'),
      cancelled: p.check(r, '취소'),
      clawback: p.check(r, '환수'), clawbackAt: p.date(r, '환수일'),
      clawbackReason: p.text(r, '환수사유'), clawbackAmount: p.num(r, '환수금액'),
      billed: p.check(r, '청구'), collected: p.check(r, '수금'),
      /* ★청구월은 두 칸에서 세운다 */
      billMonth: billMonthOf(p.raw(r, '청구년'), p.raw(r, '청구월')),
      billYearRaw: p.raw(r, '청구년') ?? null, billMonthRaw: p.raw(r, '청구월') ?? null,
      nextRoundAt: p.date(r, '다음회차일'),
      /* 돈 */
      supplierRate: p.num(r, '공급사수수료율'), agentRate: p.num(r, '에이전시수수료율'),
      claim: p.num(r, '판매수수료'), claimIncentive: p.num(r, '공급사인센티브'),
      claimVat: p.num(r, '공급사부가세'), claimTotal: p.num(r, '청구금액'),
      pay: p.num(r, '출고수수료'), payIncentive: p.num(r, '에이전시인센티브'),
      paperFee: p.num(r, '계약서대행료'), payVat: p.num(r, '에이전시부가세'),
      payTotal: p.num(r, '지급액'),
      claimAdjust: p.num(r, '청구가감'), payAdjust: p.num(r, '지급가감'),
      adjustReason: p.text(r, '가감사유'),
      /* 글 */
      contractNo: p.text(r, '계약번호'), note: p.text(r, '비고'),
      special: p.text(r, '특이사항'), paperBy: p.text(r, '계약서작성담당'),
      sourceTab: p.text(r, '원본탭'), sourceRow: hi + 2 + i,
    });
  });
}
const totalRead = Object.values(readCount).reduce((a, b) => a + b, 0);
const balanced = totalRead === rows.length + held.length;
say(`\n■ 실적 — ${PERF_TABS.map((t) => `${t} ${readCount[t]}`).join(' · ')}`);
say(`  읽은 줄 ${totalRead} = 실은 줄 ${rows.length} + 보류 ${held.length}  → ${balanced ? '맞는다 ✓' : '★안 맞는다'}`);
if (Object.keys(missingCols).length) for (const [t, m] of Object.entries(missingCols)) say(`  ⚠ 「${t}」에 없는 열: ${m.join(' · ')}`);

/* ══ ③ 곁 원자 ═══════════════════════════════════════════ */
const side = async (tab: string, key: string, map: (p: ReturnType<typeof picker>, r: unknown[]) => any) => {
  const raw = await values(tab);
  const hi = findHeader(raw, key);
  if (hi < 0) { say(`  ★「${tab}」 머리글 없음`); return []; }
  const p = picker(raw[hi].map((x) => String(x ?? '').trim()));
  return raw.slice(hi + 1).filter((r) => Array.isArray(r) && cellText(r[raw[hi].indexOf(key)])).map((r) => map(p, r));
};

const progress = await side('정산 진행', '차량번호', (p, r) => ({
  plate: p.text(r, '차량번호'), receivedAt: p.date(r, '접수일'),
  customer: p.text(r, '고객명'), supplier: p.text(r, '공급사'), channel: p.text(r, '영업채널'),
  agent: p.text(r, '영업담당자'), product: p.text(r, '상품구분'),
  paper: p.check(r, '계약서'), delivered: p.check(r, '인도완료'), deliveredAt: p.date(r, '인도일'),
  cancelled: p.check(r, '계약취소'), clawback: p.check(r, '환수'),
  billState: p.text(r, '청구상태'),
  billMonth: (() => { const d = p.date(r, '청구월'); return d ? d.slice(0, 7) : p.text(r, '청구월'); })(),
  paidAt: p.date(r, '입금일'), note: p.text(r, '비고'),
  fixedAt: p.date(r, '고친날'), fixedBy: p.text(r, '고친사람'), code: p.text(r, '정산코드'),
}));
const vehicles = await side('차량대장', '차량번호', (p, r) => ({
  plate: p.text(r, '차량번호'), model: p.text(r, '모델'), subModel: p.text(r, '세부모델'),
  trim: p.text(r, '세부트림'), supplier: p.text(r, '공급사'),
  firstSeen: p.date(r, '처음 본 날'), lastSeen: p.date(r, '마지막 본 날'),
}));
const goods = await side('_상품', '차량번호', (p, r) => ({
  plate: p.text(r, '차량번호'), supplier: p.text(r, '공급사'), model: p.text(r, '모델명'),
  kind: p.text(r, '구분'), price: p.num(r, '차량가액'),
  m24: p.num(r, '24개월'), m36: p.num(r, '36개월'), m48: p.num(r, '48개월'), m60: p.num(r, '60개월'),
}));
say(`\n■ 곁 원자 — 정산 진행 ${progress.length} · 차량대장 ${vehicles.length} · _상품 ${goods.length}`);
say(`  ★「고친사람」이 적힌 줄 ${progress.filter((x) => x.fixedBy).length} / ${progress.length}`);

/* ══ ④ 파생 탭 — 담지 않고 «세기만» 한다 (대조용) ═════════ */
const DERIVED = tabs.filter((t) => /^\d{2}년\d{2}월$/.test(t) || t === '청구월미정' || t === '청구요약' || t === '월별 요약' || t === '수수료표 구버전');
const derived: Record<string, number> = {};
for (const t of DERIVED) {
  const raw = await values(t);
  const hi = findHeader(raw, '차량 번호') >= 0 ? findHeader(raw, '차량 번호') : findHeader(raw, '차량번호');
  derived[t] = hi < 0 ? 0 : raw.slice(hi + 1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim())).length;
}
say(`\n■ 파생 탭 — ★담지 않는다. 대조에만 쓴다`);
say(`  ${Object.entries(derived).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

/* ══ 셈 ═══════════════════════════════════════════════════ */
const live = rows.filter((r) => !r.cancelled);
const won = (n: number) => Math.round(n).toLocaleString('ko-KR');
const sum = (a: any[], f: string) => a.reduce((n, r) => n + (r[f] ?? 0), 0);
const byMonth: Record<string, { n: number; c: number; p: number }> = {};
for (const r of live) {
  const k = r.billMonth ?? '(빈칸)';
  byMonth[k] = byMonth[k] ?? { n: 0, c: 0, p: 0 };
  byMonth[k].n++; byMonth[k].c += r.claim ?? 0; byMonth[k].p += r.pay ?? 0;
}
say(`\n■ 청구월별 (취소 뺀 ${live.length}줄)`);
for (const [k, v] of Object.entries(byMonth).sort())
  say(`  ${k.padEnd(10)} ${String(v.n).padStart(3)}줄  청구 ${won(v.c).padStart(12)}  지급 ${won(v.p).padStart(12)}  남는 것 ${won(v.c - v.p).padStart(11)}`);
say(`  ${'합'.padEnd(10)} ${String(live.length).padStart(3)}줄  청구 ${won(sum(live, 'claim')).padStart(12)}  지급 ${won(sum(live, 'pay')).padStart(12)}  남는 것 ${won(sum(live, 'claim') - sum(live, 'pay')).padStart(11)}`);
say(`\n■ 청구월이 «빈칸» 인 줄 ${live.filter((r) => !r.billMonth).length} — ★0 이 아니라 「모른다」다`);

const report = {
  readAt: new Date().toISOString(), ledger: LEDGER, title: meta.properties.title,
  tabs: tabs.length, balanced,
  perf: { read: totalRead, loaded: rows.length, held: held.length, byTab: readCount },
  feeTable: feeTable.length, timingRules: timingRules.length, byMethod,
  byMachine: feeTable.filter((f) => f.byMachine).length,
  progress: progress.length, vehicles: vehicles.length, goods: goods.length,
  derived, byMonth, missingCols,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT,
  `/* ★F04 정산원장 시트 «전체» 에서 읽은 SSOT. 손으로 고치지 마라.\n`
  + `   만든 때 ${report.readAt}\n   다시 만들기: npx tsx scripts/f04-ssot.mts\n`
  + `   읽은 줄 ${totalRead} = 실은 줄 ${rows.length} + 보류 ${held.length} */\n`
  + `const F04 = ${JSON.stringify({ report, feeTable, timingRules, rows, progress, vehicles, goods, held }, null, 1)};\n`, 'utf8');
mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, `# F04 시트 전체 읽기\n\n\`\`\`\n${log.join('\n')}\n\`\`\`\n`, 'utf8');
say(`\n■ 냈다 → ${OUT}`);
if (!balanced) process.exitCode = 1;
