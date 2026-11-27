/**
 * F04 수수료표·접수 두 탭을 읽어 임시 원천의 투영을 만든다 — 정본은 프리패스 데이터. ★아무것도 안 쓴다.
 *
 *   npx tsx scripts/f04-ssot.mts               ← 키 파일이 있으면 서비스계정, 없으면 gws 로그인으로 읽는다
 *   npx tsx scripts/f04-ssot.mts --auth gws    ← gws(EMAIL_REDACTED) 로그인으로 읽는다
 *
 * ★대표 2026-09-17 「시트에 있는 모든 내용을 일단 SSOT화 하자」
 *
 * 담는 것 : 수수료표 · 접수 누적원장 (2026-10-06 대표 직접 복구 결정)
 * 안 읽는 것 : 월 탭 · 별도 회차 · 요약 · 보관본 — 접수의 과거 이력으로 통합
 *
 * 갈래와 까닭 : docs/dev/F04-SSOT.md
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { JWT } from 'google-auth-library';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { assertErp5MaintenanceWrite } from '../src/shared/erp5-write-approval.ts';
import {
  billMonthOf, cellDate, findHeader, picker, cellCheck, cellNumber, cellText,
  F04_LEDGER_TABS, F04_LEDGER_MODE, intakeSourceRows, assertIntakeHeaders, reconcileF04Intake, f04SyncInput, planF04IntakeSync, F04_SYNC_SERVER_FIELDS, f04DayKey, f04ContractKey, possibleF04KeyChange,
} from '../src/adapters/f04/sheet.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const configuredLedger = process.env.F04_SHEET_ID?.trim();
const LEDGER = arg('--id', configuredLedger || 'F04_SPREADSHEET_ID_REQUIRED');
const SA = arg('--sa', 'C:/dev/freepasserp4/tmp/firebase-auth/sa.json');
const OUT = arg('--out', 'docs/ui/mockups/f04.ssot.js');
const REPORT = arg('--report', 'docs/dev/evidence/F04-SSOT-READ.md');

/*
 * ★읽는 길 둘 — 둘 다 «읽기만» 한다.
 *   sa  : 서비스계정 키 파일(--sa) + 도메인 위임(EMAIL_REDACTED). 키 파일이 있을 때만.
 *   gws : Google Workspace CLI(gws) 의 로그인(EMAIL_REDACTED, spreadsheets·drive 범위 — 2026-10-03 부여).
 *         2026-10-02 예시금융사 정산서가 키 파일 없음·403 으로 멈췄다 → 키 파일이 없으면 gws 로 읽는다.
 *   고르는 법: --auth sa|gws. 안 주면 키 파일이 있으면 sa, 없으면 gws.
 * 값은 두 길 모두 UNFORMATTED_VALUE — 날짜가 구글 serial 숫자로 오고 sheet.ts 가 되돌린다.
 */
const PLAN = arg('--plan', '');
const APPROVED = arg('--apply-plan', '');
const RECONCILE = process.argv.includes('--reconcile') || !!PLAN || !!APPROVED;
if ((PLAN || APPROVED) && !/^[A-Za-z0-9_-]{30,}$/.test(LEDGER)) throw new Error('F04 정본 문서 ID가 필요합니다');
if (APPROVED && (!configuredLedger || LEDGER !== configuredLedger)) throw new Error('승인된 F04 원장 설정이 필요합니다');
if (PLAN && APPROVED) throw new Error('반영 계획 생성과 승인 실행을 한 번에 할 수 없습니다');
if (['--plan', '--apply-plan'].some(option => process.argv.includes(option) && !arg(option, ''))) {
  throw new Error('계획 파일 경로가 필요합니다');
}
const AUTH = arg('--auth', !RECONCILE && existsSync(SA) ? 'sa' : 'gws');
if (AUTH !== 'sa' && AUTH !== 'gws') throw new Error(`--auth 는 sa 또는 gws: ${AUTH}`);

const a1 = (tab: string, cells = 'A1:CZ2000') => `'${tab.replace(/'/g, "''")}'!${cells}`;

let readMeta: () => Promise<any>;
let values: (tab: string, range?: string) => Promise<unknown[][]>;

if (AUTH === 'sa') {
  const sa = JSON.parse(readFileSync(SA, 'utf8'));
  const jwt = new JWT({
    email: sa.client_email, key: sa.private_key, subject: 'EMAIL_REDACTED',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],   /* ★읽기만 한다 */
  });
  const api = async (u: string) => {
    const t = (await jwt.getAccessToken()).token;
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
    return r.json() as Promise<any>;
  };
  readMeta = () => api(`https://sheets.googleapis.com/v4/spreadsheets/${LEDGER}?fields=properties.title,sheets.properties.title`);
  values = async (tab, range) =>
    ((await api(`https://sheets.googleapis.com/v4/spreadsheets/${LEDGER}/values/${encodeURIComponent(a1(tab, range))}?valueRenderOption=UNFORMATTED_VALUE`)).values ?? []) as unknown[][];
} else {
  const bin = gwsBinary();
  const gws = (args: string[]) => {
    const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.error) throw new Error(`gws 를 실행하지 못했다(${bin}) — ${r.error.message}. GWS_BIN 으로 경로를 알려 준다`);
    const out = String(r.stdout ?? '');
    const at = out.indexOf('{');
    if (r.status !== 0 || at < 0) throw new Error(`gws 읽기 실패(${r.status}) — ${(String(r.stderr ?? '') + out).trim().slice(0, 240)}`);
    return JSON.parse(out.slice(at));
  };
  readMeta = async () => gws(['sheets', 'spreadsheets', 'get', '--params',
    JSON.stringify({ spreadsheetId: LEDGER, fields: 'properties.title,sheets.properties.title' })]);
  values = async (tab, range) => (gws(['sheets', 'spreadsheets', 'values', 'get', '--params',
    JSON.stringify({ spreadsheetId: LEDGER, range: a1(tab, range), valueRenderOption: 'UNFORMATTED_VALUE' })]).values ?? []) as unknown[][];
}

/**
 * gws 실행 파일 — GWS_BIN 이 있으면 그것. 없으면 Windows npm 전역 실행기(gws.ps1)가 가리키는 gws.exe, 그도 없으면 PATH 의 gws.
 * (gws.ps1 · gws.cmd 는 shell 없이 띄울 수 없어 실제 exe 를 찾는다 — JSON 인자를 shell 따옴표로 깨뜨리지 않으려고)
 */
function gwsBinary(): string {
  if (process.env.GWS_BIN) return process.env.GWS_BIN;
  const ps1 = process.env.APPDATA ? join(process.env.APPDATA, 'npm', 'gws.ps1') : '';
  if (ps1 && existsSync(ps1)) {
    const m = /'([^']+gws\.exe)'/i.exec(readFileSync(ps1, 'utf8'));
    if (m && existsSync(m[1])) return m[1];
  }
  return 'gws';
}
const log: string[] = [];
const say = (s: string) => { console.error(s); log.push(s); };

if (RECONCILE) {
  const raw = await values('접수', 'A1:CZ');
  const header = findHeader(raw);
  if (header < 0) throw new Error('접수 머리글 없음');
  const head = raw[header].map(String);
  assertIntakeHeaders(head);
  const field = picker(head);
  const intake = intakeSourceRows(raw, header, !!PLAN || !!APPROVED);
  const source = intake.map(({ values: row, sourceRow }) => ({
    plate: field.text(row, '차량번호'), receivedAt: field.date(row, '접수일'), sourceRow,
  }));

  const gcloud = process.platform === 'win32' ? 'powershell.exe' : 'gcloud';
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-NonInteractive', '-Command', '& gcloud.cmd auth print-access-token --quiet']
    : ['auth', 'print-access-token', '--quiet'];
  const result = spawnSync(gcloud, args, { encoding: 'utf8', timeout: 30_000, windowsHide: true });
  const token = result.stdout?.trim();
  if (result.status !== 0 || !token) throw new Error('Firestore 읽기 계정 인증 실패');
  const selected = ['plate', 'receivedAt', 'sourceTab', 'fromSheet', 'sourceRow', '_f04.at',
    ...((PLAN || APPROVED) ? F04_SYNC_SERVER_FIELDS : [])];
  const response = await fetch('https://firestore.googleapis.com/v1/projects/freepasserp5/databases/(default)/documents:runQuery', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'settlement_rows' }],
      select: { fields: selected.map(fieldPath => ({ fieldPath })) },
    } }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Firestore 정산원장 읽기 실패 (HTTP ${response.status})`);
  const replies = await response.json() as {
    readTime?: string;
    document?: { name: string; updateTime?: string; fields?: Record<string, FirestoreValue> };
  }[];
  if (!Array.isArray(replies) || !replies.some(reply => reply.readTime)) throw new Error('Firestore 응답에 읽기 시각 없음');
  const records = replies.flatMap(({ document }) => {
    if (!document) return [];
    const r = document.fields;
    const sourceRow = Number(r?.sourceRow?.integerValue);
    return [{ plate: r?.plate?.stringValue, receivedAt: r?.receivedAt?.stringValue ?? r?.receivedAt?.timestampValue,
      sourceTab: r?.sourceTab?.stringValue, fromSheet: r?.fromSheet?.stringValue,
      sourceRow: Number.isSafeInteger(sourceRow) && sourceRow > 0 ? sourceRow : undefined,
      f04ImportedAt: r?._f04?.mapValue?.fields?.at?.stringValue }];
  });
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const audit = reconcileF04Intake(source, records, today);
  const readTime = replies.at(-1)?.readTime;
  if (PLAN || APPROVED) {
    const server = replies.flatMap(({ document }) => document ? [{
      id: document.name.split('/').at(-1)!,
      updateTime: document.updateTime ?? '',
      data: Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, decode(value)])),
    }] : []);
    const proposal = planF04IntakeSync(intake.map(({ values, sourceRow }) => f04SyncInput(field, values, sourceRow)), server, today);
    const summary = {
      schema: 'f04-intake-sync/v1', today, readTime, fingerprint: proposal.fingerprint,
      ledgerFingerprint: createHash('sha256').update(LEDGER).digest('hex'),
      counts: Object.fromEntries(['추가', '갱신', '보류'].map(action => [action, proposal.entries.filter(r => r.action === action).length])),
      unchanged: proposal.unchanged,
      missingPostCutover: audit.adminOnlyInSheet.length,
      sourceOnlyRows: audit.adminOnlyInSheet,
      invalidKeyRows: audit.sheetRowsMissingValidKey,
      legacyReviewOnly: audit.legacyOrphans,
      serverOnlyReview: proposal.serverOnlyReview,
      entries: proposal.entries,
    };
    if (PLAN) {
      writeFileSync(PLAN, JSON.stringify(summary, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
      console.log(JSON.stringify({ ...summary, entries: undefined, sourceOnlyRows: undefined, invalidKeyRows: undefined }));
    } else {
      const approved = JSON.parse(readFileSync(APPROVED, 'utf8'));
      if (approved.schema !== summary.schema || approved.today !== today || approved.fingerprint !== proposal.fingerprint ||
          approved.ledgerFingerprint !== summary.ledgerFingerprint) {
        throw new Error('승인 계획과 현재 원장이 다릅니다. 계획을 다시 생성하고 승인받으세요');
      }
      await applyApprovedPlan(proposal);
    }
  } else {
    console.log(JSON.stringify({ readTime, ...audit }, null, 2));
  }
} else {
  await writeSnapshot();
}

type FirestoreValue = {
  stringValue?: string; integerValue?: string; timestampValue?: string; booleanValue?: boolean; doubleValue?: number;
  mapValue?: { fields?: Record<string, FirestoreValue> };
};
function decode(value: FirestoreValue): unknown {
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, child]) => [key, decode(child)]));
  if (value.integerValue !== undefined) return Number(value.integerValue);
  return value.booleanValue ?? value.doubleValue ?? value.stringValue ?? value.timestampValue ?? null;
}

function exactTimestamp(value: string) {
  const match = /^(.*?)(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(match[1] + 'Z'))) throw new Error('서버 문서 갱신 시각을 확인할 수 없습니다');
  return new Timestamp(Date.parse(match[1] + 'Z') / 1000, Number((match[2] ?? '').padEnd(9, '0')));
}

async function applyApprovedPlan(proposal: ReturnType<typeof planF04IntakeSync>) {
  if (!proposal.writes.length) { console.log('승인 계획에서 쓸 행 0건'); return; }
  if (proposal.writes.length > 200) throw new Error('단일 트랜잭션 200행 한도를 넘습니다. 적용 전에 관제탑에 확인하세요');
  if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('운영 계획으로 에뮬레이터에 쓰지 않습니다');
  const credentialPath = arg('--sa', process.env.ERP5_SERVICE_ACCOUNT_PATH ?? '');
  if (!credentialPath) throw new Error('승인된 기존 ERP5 서비스 계정 설정이 필요합니다');
  const account = JSON.parse(readFileSync(credentialPath, 'utf8'));
  if (account.project_id !== 'freepasserp5' || !String(account.client_email ?? '').endsWith('@freepasserp5.iam.gserviceaccount.com')) {
    throw new Error('승인된 ERP5 자격 증명이 아닙니다');
  }
  assertErp5MaintenanceWrite(process.env, true, 'F04 접수 반영', Date.now(), account.client_email);
  const db = getFirestore(initializeApp({ credential: cert(account), projectId: 'freepasserp5' }, 'f04-intake-sync'));
  const rows = db.collection('settlement_rows');
  const events = db.collection('settlement_events');
  const now = Date.now();
  await db.runTransaction(async tx => {
    const actual = (await tx.get(rows.select('plate', 'receivedAt', 'contractNo', 'agent', 'supplier', 'claimWritten', 'payWritten', 'rent'))).docs;
    const keys = new Map<string, typeof actual>();
    for (const doc of actual) {
      const key = f04DayKey(doc.data());
      keys.set(key, [...(keys.get(key) ?? []), doc]);
    }
    for (const op of proposal.writes) {
      const sameDay = keys.get(op.key) ?? [];
      const candidates = sameDay.filter(doc => !op.source.contractNo ||
        !doc.get('contractNo') || f04ContractKey(doc.data()) === f04ContractKey(op.source));
      if (op.action === '추가') {
        if (candidates.length || actual.some(doc => possibleF04KeyChange(op.source, doc.data()))) {
          throw new Error('승인 후 같은 접수 또는 키 변경 의심 건이 서버에 생겼습니다');
        }
      } else if (candidates.length !== 1 || candidates[0].id !== op.id ||
          !candidates[0].updateTime?.isEqual(exactTimestamp(op.updateTime ?? ''))) {
        throw new Error('승인 후 서버 행이 변경되었습니다');
      }
    }
    for (const op of proposal.writes) {
      const data = { ...op.data, updatedAt: now };
      if (op.action === '추가') tx.create(rows.doc(op.id), { ...data, createdAt: now, stateAt: new Date(now).toISOString() });
      else tx.update(rows.doc(op.id), data as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
      const auditKey = 'f04_sync_' + proposal.fingerprint.slice(0, 24) + '_' + op.row;
      tx.set(events.doc(op.auditEventId), {
        [auditKey]: { at: now, by: 'f04-intake-sync', field: op.action, source: 'F04', row: op.row },
      }, { merge: true });
    }
  });
  const confirmed = await db.getAll(...proposal.writes.map(op => rows.doc(op.id)));
  for (const [index, doc] of confirmed.entries()) {
    const op = proposal.writes[index];
    if (!doc.exists || Object.entries(op.data)
      .filter(([key, value]) => key !== 'createdAt' && key !== 'updatedAt' && key !== 'stateAt' && typeof value !== 'object')
      .some(([key, value]) => doc.get(key) !== value)) {
      throw new Error('반영 후 재조회가 계획과 다릅니다. 재실행 전에 관제탑에 확인하세요');
    }
  }
  console.log(`반영 및 재조회 완료 ${proposal.writes.length}행`);
}

async function writeSnapshot() {
const meta = await readMeta();
const tabs: string[] = meta.sheets.map((s: any) => s.properties.title);
say(`■ ${meta.properties.title}  (읽은 길: ${AUTH})`);
say(`  탭 ${tabs.length}개`);

/* 청구·지급 시점 설명만 보존한다. 요율표를 해석하거나 금액을 옮기지 않는다. */
const feeRows = await values('수수료표');
const fh = findHeader(feeRows, '공급사');
if (fh < 0) throw new Error('★수수료표 머리글을 못 찾았다 — 말없이 넘어가지 않는다');
/* ★같은 탭에 표가 «둘» 있다 — 요율표 아래에 「청구·지급 시점」 규칙표가 붙어 있다.
   두 번째 머리글은 「누가 · 어떤 건 · 어떻게」 다. 거기서 끊는다. */
const secondHead = feeRows.findIndex((r, i) => i > fh && String(r?.[0] ?? '').trim() === '누가');
const timingRules = secondHead > 0
  ? feeRows.slice(secondHead + 1).filter((r) => cellText(r?.[0]))
      .map((r) => ({ who: cellText(r[0]), what: cellText(r[1]), how: cellText(r[2]) }))
  : [];
say(`
■ ★청구·지급 «시점» 규칙 ${timingRules.length}줄 — 요율과 «따로» 도는 규칙이다`);
for (const t of timingRules) say(`  ${(t.who ?? '').padEnd(12)} ${(t.what ?? '').padEnd(10)} ${t.how ?? ''}`);

/* ══ ② 실적 네 탭 — 54열이 «같은 규격» 이라 한 벌로 합친다 ══ */
const PERF_TABS = F04_LEDGER_TABS;
const rows: any[] = [];
const held: { tab: string; row: number; why: string }[] = [];
const readCount: Record<string, number> = {};
const missingCols: Record<string, string[]> = {};

for (const tab of PERF_TABS) {
  const raw = await values(tab);
  const hi = findHeader(raw, '차량번호');
  if (hi < 0) { say(`  ★「${tab}」 머리글을 못 찾았다 — 건너뛰지 않고 멈춘다`); throw new Error(`머리글 없음: ${tab}`); }
  const head = raw[hi].map((x) => String(x ?? '').trim());
  assertIntakeHeaders(head);
  const p = picker(head);
  const miss = p.missing(['차량번호', '접수일', '공급사', '청구년', '청구월', '청구액', '지급액']);
  if (miss.length) missingCols[tab] = miss;
  const body = intakeSourceRows(raw, hi);
  readCount[tab] = body.length;

  body.forEach(({ values: r, sourceRow }) => {
    const plate = p.text(r, '차량번호');
    const receivedAt = p.date(r, '접수일');
    /* ★버리지 않는다 — 열쇠가 없으면 보류함에 «까닭과 함께» */
    if (!plate) { held.push({ tab, row: sourceRow, why: '차량번호 없음' }); return; }
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
      claimIncentive: p.num(r, '공급사인센티브'), payIncentive: p.num(r, '에이전시인센티브'),
      paperFee: p.num(r, '계약서대행료'),
      billState: p.text(r, '청구상태'), payState: p.text(r, '지급상태'),
      history: p.text(r, '처리 이력'),
      claimAdjust: p.num(r, '청구가감'), payAdjust: p.num(r, '지급가감'),
      adjustReason: p.text(r, '가감사유'),
      /* 글 */
      contractNo: p.text(r, '계약번호'), note: p.text(r, '비고'),
      special: p.text(r, '특이사항'), paperBy: p.text(r, '계약서작성담당'),
      sourceTab: p.text(r, '원본탭'), sourceRow,
    });
  });
}
const totalRead = Object.values(readCount).reduce((a, b) => a + b, 0);
const balanced = totalRead === rows.length + held.length;
say(`\n■ 실적 — ${PERF_TABS.map((t) => `${t} ${readCount[t]}`).join(' · ')}`);
say(`  읽은 줄 ${totalRead} = 실은 줄 ${rows.length} + 보류 ${held.length}  → ${balanced ? '맞는다 ✓' : '★안 맞는다'}`);
if (Object.keys(missingCols).length) for (const [t, m] of Object.entries(missingCols)) say(`  ⚠ 「${t}」에 없는 열: ${m.join(' · ')}`);

/* 2026-10-06 대표 복구 지시: 수수료표·접수 두 탭만 읽는다.
 * 회차·과거 발행 사실은 접수 처리 이력에 통합했다. 숨긴 보관본 재합산 금지. */
const installments: any[] = [];
const progress: any[] = [];
const vehicles: any[] = [];
const goods: any[] = [];
const derived: Record<string, number> = {};
/* ══ 셈 ═══════════════════════════════════════════════════ */
const live = rows.filter((r) => !r.cancelled);
const byMonth: Record<string, { n: number }> = {};
for (const r of live) {
  const k = r.billMonth ?? '(빈칸)';
  byMonth[k] = byMonth[k] ?? { n: 0 };
  byMonth[k].n++;
}
say(`\n■ 청구월이 «빈칸» 인 줄 ${live.filter((r) => !r.billMonth).length} — ★0 이 아니라 「모른다」다`);

const report = {
  readAt: new Date().toISOString(), ledger: LEDGER, title: meta.properties.title,
  tabs: tabs.length, balanced,
  perf: { read: totalRead, loaded: rows.length, held: held.length, byTab: readCount },
  timingRules: timingRules.length,
  progress: progress.length, vehicles: vehicles.length, goods: goods.length,
  derived, byMonth, missingCols, ledgerMode: F04_LEDGER_MODE, installments: 0, noInstallments: true,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT,
  `/* ★F04 정산원장 시트 «전체»를 읽은 사본. 손으로 고치지 마라.\n`
  + `   수수료·청구액·지급액·요율은 읽거나 저장하지 않는다. 금액 정본은 프리패스 데이터다.\n`
  + `   만든 때 ${report.readAt}\n   다시 만들기: npx tsx scripts/f04-ssot.mts\n`
  + `   읽은 줄 ${totalRead} = 실은 줄 ${rows.length} + 보류 ${held.length} */\n`
  + `const F04 = ${JSON.stringify({ report, timingRules, rows, installments, progress, vehicles, goods, held }, null, 1)};\n`, 'utf8');
mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, `# F04 시트 전체 읽기\n\n\`\`\`\n${log.join('\n')}\n\`\`\`\n`, 'utf8');
say(`\n■ 냈다 → ${OUT}`);
if (!balanced) process.exitCode = 1;
}
