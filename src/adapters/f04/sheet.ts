/**
 * F04 정산원장 시트를 읽는 «순수한» 조각들.
 *
 * ★자리로 읽지 않는다 — 열 «이름» 으로 붙인다.
 *   원본은 열 자리가 흔들린다(fp4 실측: 「추가 인센티브」가 25·26·27·35·36·39·40번째에 다 나온다).
 *   자리로 옮기면 한 칸 밀린 값이 «돈» 이 된다.
 *
 * ★시트가 값을 바꿔 놓은 것을 되돌린다.
 *   ① 날짜는 구글 serial 숫자로 온다 — `45301` 을 그냥 Date 에 넣으면 45301년이 된다
 *   ② 「2026-08」 을 적으면 구글이 날짜로 바꿔 `46235` 로 돌려준다 (SHEET_MAP §3-1 경고)
 */

import { createHash } from 'node:crypto';
import { isCalendarDay, isCalendarMonth } from '../../domain/settlement/calendar';
import { intakeRecord, settlementStartedOf } from '../../domain/settlement/intake';
import { intakeAuthorityForDate, settlementKey, intakeEventDocId, intakeCode } from '../../domain/settlement/code';

/** 구글 serial 0점 — 1899-12-30 */
const SERIAL0 = Date.UTC(1899, 11, 30);
const p2 = (n: number) => String(n).padStart(2, '0');

export const isSerial = (n: number) => Number.isFinite(n) && n > 20000 && n < 80000;

/** serial → `YYYY-MM-DD`. serial 이 아니면 null */
export function serialToDate(n: number): string | null {
  if (!isSerial(n)) return null;
  const d = new Date(SERIAL0 + Math.round(n) * 86_400_000);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

/** 시트 칸 → `YYYY-MM-DD`. 못 읽으면 null (★0 이 아니다) */
export function cellDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (isSerial(n)) return serialToDate(n);
  const s = String(v).trim();
  const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${p2(+m[2])}-${p2(+m[3])}`;
  return null;
}

/**
 * ★청구월을 «두 칸» 에서 세운다 — `청구년` + `청구월`.
 *
 *   시트는 「9」 같은 숫자로 들고 있고 년은 따로다. ERP5 의 `"2026-09"` 는 그 둘을 합친 파생값이다.
 *   그런데 사람이 「2026-09」 를 통째로 적으면 구글이 «날짜» 로 바꿔 `46266` 을 돌려준다.
 *   셋 다 받아 하나로 만든다. 못 만들면 null — 「모른다」다.
 */
export function billMonthOf(year: unknown, month: unknown): string | null {
  const my = Number(month);
  /* 사람이 「2026-09」를 적어 구글이 날짜로 바꿔 놓은 경우 */
  if (isSerial(my)) {
    const d = serialToDate(my);
    return d ? d.slice(0, 7) : null;
  }
  const ms = String(month ?? '').trim();
  const direct = /^(\d{4})[-./](\d{1,2})$/.exec(ms);
  if (direct) return `${direct[1]}-${p2(+direct[2])}`;
  if (!ms) return null;
  const m = Number(ms);
  if (!Number.isFinite(m) || m < 1 || m > 12) return null;
  const y = Number(String(year ?? '').trim());
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;   /* 년을 모르면 달도 못 세운다 */
  return `${y}-${p2(m)}`;
}

/** 시트 칸 → 수. ★빈칸·못 읽음은 null 이다. 0 이 아니다 */
export function cellNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').replace(/[,\s원%]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 시트 칸 → 글. 빈칸은 null */
export function cellText(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

/**
 * F04 snapshot 필드명 → 현재 settlement_rows 정본 필드명.
 * 과거 snapshot은 「납입회차」를 rounds로 저장했지만 Admin 정본은 paidRounds다.
 * migration에서 이 경계를 반드시 한 번 통과시켜 legacy 이름이 Firestore에 다시 생기지 않게 한다.
 */
export function f04SettlementField(name: string): string {
  return name === 'rounds' ? 'paidRounds' : name;
}

/** 시트 체크 — 「TRUE·true·참·Y·예·1」 이 섞여 있다 */
export function cellCheck(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return /^(TRUE|참|Y|예|1)$/i.test(String(v ?? '').trim());
}

/**
 * 머리글 줄을 찾는다 — 「차량번호」가 있는 줄.
 * ★1행은 탭 안내문이라 머리글이 아니다. 못 찾으면 -1 을 내고 **말없이 넘어가지 않는다**.
 */
export function findHeader(rows: unknown[][], key = '차량번호'): number {
  return rows.findIndex((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() === key));
}

/** 2026-10-02: 접수는 누적 원장. 실적/취소 탭은 보관본이며 다시 합산하지 않는다. */
export const F04_LEDGER_TABS = ['접수'] as const;

export const F04_LEDGER_MODE = 'INTAKE_ONLY_TWO_TABS' as const;

export function assertIntakeHeaders(head: string[]) {
  const missing = picker(head).missing(['차량번호', '접수일', '공급사', '청구년', '청구월', '청구액', '지급액', '청구', '청구상태']);
  if (missing.length) throw new Error(`접수 필수 열 없음: ${missing.join(', ')}`);
}

export function assertIntakeOnlySnapshot(snapshot: {
  report?: { ledgerMode?: string; installments?: number };
  installments?: unknown[];
}) {
  if (snapshot.report?.ledgerMode !== F04_LEDGER_MODE || snapshot.report.installments !== 0 ||
      !Array.isArray(snapshot.installments) || snapshot.installments.length !== 0) {
    throw new Error('접수 단일원장 사본이 아니다 — 수수료표·접수만 다시 읽은 뒤 발행한다');
  }
}

export function intakeSourceRows(raw: unknown[][], headerIndex: number, allowDuplicateKeys = false) {
  if (headerIndex < 0) throw new Error('접수 머리글 없음');
  const p = picker(raw[headerIndex].map(String));
  const facts = ['접수일', '차량번호', '공급사', '모델명', '영업채널', '영업담당자',
    '고객명', '특이사항', '상품구분', '계약기간', '렌탈료', '보증금', '차량가액', '분납여부'];
  const seen = new Set<string>();
  return raw.slice(headerIndex + 1).map((r, i) => ({ values: r, sourceRow: headerIndex + 2 + i }))
    .filter(({ values }) => facts.some((name) => {
      const v = p.raw(values, name);
      return v !== false && v !== null && v !== undefined && String(v).trim() !== '';
    }))
    .map((r) => {
      const plate = p.text(r.values, '차량번호')?.replace(/\s/g, '');
      const day = p.date(r.values, '접수일');
      if (plate && day) {
        const key = `${plate}|${day}`;
        if (!allowDuplicateKeys && seen.has(key)) throw new Error(`접수 원장 중복: row ${r.sourceRow}`);
        seen.add(key);
      }
      return r;
    });
}

type IntakeAuditRow = {
  plate?: unknown;
  receivedAt?: unknown;
  sourceRow?: number;
  fromSheet?: unknown;
  sourceTab?: unknown;
  f04ImportedAt?: unknown;
};

export function reconcileF04Intake(source: IntakeAuditRow[], server: IntakeAuditRow[], today: string) {
  const dayOf = (row: IntakeAuditRow) => {
    const value = cellDate(row.receivedAt);
    const time = value && Date.parse(value + 'T00:00:00Z');
    return value && typeof time === 'number' && Number.isFinite(time)
      && new Date(time).toISOString().slice(0, 10) === value ? value : null;
  };
  const keyOf = (row: IntakeAuditRow) => {
    const day = dayOf(row);
    const plate = cellText(row.plate);
    return day && plate ? settlementKey(plate, day) : '';
  };
  const keys = (rows: IntakeAuditRow[]) => new Set(rows.map(keyOf).filter(Boolean));
  const inSheet = keys(source);
  const inServer = keys(server);
  const gaps: number[] = [];
  const missingKey: number[] = [];
  for (const row of source) {
    const key = keyOf(row);
    const day = dayOf(row);
    if (!key || !day || day > today) {
      if (row.sourceRow !== undefined) missingKey.push(row.sourceRow);
    } else if (intakeAuthorityForDate(day) === 'ADMIN' && !inServer.has(key) && row.sourceRow !== undefined) {
      gaps.push(row.sourceRow);
    }
  }
  const dates = server.map(dayOf).filter((day): day is string => !!day && day <= today).sort();
  const legacyOrphans = server.flatMap((row) => {
    const declared = [row.sourceTab, row.fromSheet].flatMap(value => cellText(value) ?? []);
    const tab = declared.find(value => value === '분납실적' || value === '완납실적')
      ?? (declared.some(value => value.includes('분납실적') && value.includes('완납실적')) ? '옛 통합 원장' : null);
    const key = keyOf(row);
    return tab && key && !inSheet.has(key) ? [{ tab, day: dayOf(row), sourceRow: row.sourceRow ?? null }] : [];
  });
  const imports = server.map(row => cellText(row.f04ImportedAt))
    .filter((value): value is string => !!value && Number.isFinite(Date.parse(value))).sort();
  return {
    sourceRows: source.length, serverRows: server.length,
    latestSheetReceipt: source.map(dayOf).filter((day): day is string => !!day && day <= today).sort().at(-1) ?? null,
    latestServerReceipt: dates.at(-1) ?? null,
    lastRecordedF04Import: imports.at(-1) ?? null,
    serverFutureReceipts: server.filter(row => (dayOf(row) ?? '') > today).length,
    adminOnlyInSheet: gaps, sheetRowsMissingValidKey: missingKey, legacyOrphans,
  };
}

/** 이름으로 칸을 집는 손 — 없는 열은 «없다» 고 말한다 (★-1 로 조용히 0 을 내지 않는다) */
export function picker(head: string[]) {
  const idx = new Map<string, number>();
  head.forEach((h, i) => { const t = String(h ?? '').trim(); if (t && !idx.has(t)) idx.set(t, i); });
  const at = (name: string) => idx.has(name) ? idx.get(name)! : -1;
  return {
    has: (name: string) => idx.has(name),
    raw: (row: unknown[], name: string) => { const i = at(name); return i < 0 ? undefined : row[i]; },
    text: (row: unknown[], name: string) => { const i = at(name); return i < 0 ? null : cellText(row[i]); },
    num: (row: unknown[], name: string) => { const i = at(name); return i < 0 ? null : cellNumber(row[i]); },
    date: (row: unknown[], name: string) => { const i = at(name); return i < 0 ? null : cellDate(row[i]); },
    check: (row: unknown[], name: string) => { const i = at(name); return i < 0 ? false : cellCheck(row[i]); },
    missing: (names: string[]) => names.filter((x) => !idx.has(x)),
  };
}

const F04_SYNC_FIELDS = ['model', 'supplier', 'product', 'rentKind', 'contractType', 'term', 'rent', 'deposit', 'price', 'payKind'] as const;
export const F04_SYNC_SERVER_FIELDS = [
  ...F04_SYNC_FIELDS, 'customer', 'channel', 'agent', 'note', 'claimWritten', 'payWritten',
  'invoiceIssued', 'invoiceAt', 'invoiceNoS', 'invoiceNoP', 'billed', 'billedAt', 'collected', 'collectedAt',
  'collectedAmt', 'paid', 'paidAt', 'paidAmt', 'billMonth', 'settledAlready', 'stage', 'claimStage', 'payStage',
  'supplierOk', 'channelOk', 'supplierFix', 'channelFix', 'auditEventId', '_f04Sync', 'contractNo', 'f04SourceIdentity',
];

function sentChargeDate(evidence: string, billMonth: string): string {
  const dates = new Set<string>();
  const sendDates = new Set<string>();
  const normalized = evidence.normalize('NFKC');
  const monthKnown = isCalendarMonth(billMonth);
  const [billYear, billMonthNumber] = billMonth.split('-').map(Number);
  const tokens = /(?<![\d./-])(?:(20\d{2})[./-])?(\d{1,2})[./-](\d{1,2})(?![\d./-])/g;
  for (const match of normalized.matchAll(tokens)) {
    const month = Number(match[2]);
    const monthOffset = (month + 12 - billMonthNumber) % 12;
    if (!match[1] && (!monthKnown || monthOffset > 1)) continue;
    const year = match[1] || String(billYear + Number(month < billMonthNumber));
    const date = year + '-' + p2(month) + '-' + p2(Number(match[3]));
    if (!isCalendarDay(date)) continue;
    dates.add(date);
    const after = normalized.slice(match.index + match[0].length);
    if (/^\s*(?:카카오톡|카톡|이메일|메일|발송|전송|보냄)/.test(after)) sendDates.add(date);
  }
  const candidates = sendDates.size ? sendDates : dates;
  return candidates.size === 1 ? [...candidates][0] : '';
}

export function f04SyncInput(field: ReturnType<typeof picker>, row: unknown[], sourceRow: number) {
  const text = (name: string) => field.text(row, name) ?? '';
  const invalidAmounts: string[] = [];
  const number = (name: string) => {
    const value = field.raw(row, name);
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (name === '보증금' && String(value).trim() === '무보증') return 0;
    const match = /^([+-]?)\s*₩?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:원)?$/.exec(String(value).trim());
    const parsed = match ? Number(match[1] + match[2].replace(/,/g, '')) : NaN;
    if (Number.isFinite(parsed)) return parsed;
    invalidAmounts.push(name);
    return null;
  };
  const done = (name: string) => /^(?:청구|수금|지급)?\\s*완료$/.test(text(name));
  const billMonth = billMonthOf(field.raw(row, '청구년'), field.raw(row, '청구월')) ?? '';
  const billState = text('청구상태').normalize('NFKC').replace(/\s/g, '');
  const evidence = text('청구 발송증빙');
  const sentCharge = billState === '청구발송증빙확인' ||
    (!!evidence && /^(?:기청구|(?:청구서?)?발송(?:완료|증빙확인|증빙있음))$/.test(billState));
  const explicitBilledAt = field.date(row, '청구 최종발송일') ?? '';
  const billedAt = isCalendarDay(explicitBilledAt) ? explicitBilledAt : sentCharge ? sentChargeDate(evidence, billMonth) : '';
  const delivered = field.check(row, '인도완료');
  return {
    sourceRow,
    contractNo: verifiedF04Contract(text('계약번호')),
    createdMarker: text('행 생성 표식') || text('접수 ID'),
    invalidAmounts,
    plate: text('차량번호').replace(/\\s/g, ''), receivedAt: field.date(row, '접수일') ?? '',
    supplier: text('공급사'), supplierCode: '', model: text('모델명'), customer: text('고객명'),
    channel: text('영업채널'), channelCode: '', agent: text('영업담당자'), agentCode: '',
    product: text('상품구분'), rentKind: text('렌트구분'), contractType: text('계약형태'),
    term: number('계약기간'), rent: number('렌탈료'), deposit: number('보증금'), price: number('차량가액'),
    payKind: text('분납여부'), paper: field.check(row, '계약서'), delivered,
    deliveredAt: delivered ? (field.date(row, '인도일') ?? '') : '', note: text('비고'), cancelled: field.check(row, '취소'),
    sentCharge, billed: sentCharge || field.check(row, '청구') || done('청구상태'),
    collected: field.check(row, '수금'), paid: done('지급상태'),
    claimWritten: number('청구액'), payWritten: number('지급액'),
    billMonth, billedAt,
    collectedAt: field.date(row, '최종 수금일') ?? '', paidAt: field.date(row, '최종 지급일') ?? '',
    collectedAmt: number('수금 누계액'), paidAmt: number('지급 누계액'),
    claimVat: number('공급사부가세'), payVat: number('에이전시부가세'),
    claimTotal: number('청구금액'), payTotal: number('지급합계(부가세포함)'),
  };
}

type F04SyncSource = ReturnType<typeof f04SyncInput>;
type F04SyncServer = { id: string; updateTime: string; data: Record<string, unknown> };
type F04SyncWrite = { action: '추가' | '갱신'; id: string; updateTime?: string; row: number; key: string; auditEventId: string; source: F04SyncSource; data: Record<string, unknown> };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');

function verifiedF04Contract(value: unknown): string {
  const text = cellText(value) ?? '';
  return /^[\p{L}\d_-]{4,64}$/u.test(text) && /\d/.test(text) ? text : '';
}

export const f04DayKey = (r: { plate?: unknown; receivedAt?: unknown }) => settlementKey(r.plate, cellDate(r.receivedAt));
export const f04ContractKey = (r: { plate?: unknown; receivedAt?: unknown; contractNo?: unknown }) =>
  f04DayKey(r) + '|' + verifiedF04Contract(r.contractNo);

export function possibleF04KeyChange(row: F04SyncSource, cur: Record<string, unknown>) {
  const day = cellDate(cur.receivedAt);
  const person = (value: unknown) => (cellText(value) ?? '').normalize('NFKC').replace(/\s/g, '');
  if (!day || f04DayKey(row) === f04DayKey(cur) || !person(row.agent) || !person(row.supplier) ||
      person(row.agent) !== person(cur.agent) || person(row.supplier) !== person(cur.supplier) ||
      Math.abs(Date.parse(row.receivedAt) - Date.parse(day)) > 3 * 86_400_000) return false;
  const amounts = (['claimWritten', 'payWritten', 'rent'] as const)
    .filter(key => row[key] !== null && cur[key] !== null && cur[key] !== '' && Number.isFinite(Number(cur[key])));
  return amounts.length > 0 && amounts.every(key => row[key] === Number(cur[key]));
}

export function planF04IntakeSync(source: F04SyncSource[], server: F04SyncServer[], today: string) {
  const byKey = new Map<string, F04SyncServer[]>();
  const serverIds = new Set(server.map(entry => entry.id));
  for (const entry of server) {
    const key = f04DayKey(entry.data);
    const values = byKey.get(key) ?? [];
    values.push(entry);
    byKey.set(key, values);
  }
  const sourceKeys = new Map<string, F04SyncSource[]>();
  for (const row of source) {
    const key = f04DayKey(row);
    sourceKeys.set(key, [...(sourceKeys.get(key) ?? []), row]);
  }
  const writes: F04SyncWrite[] = [];
  const entries: { row: number; action: '추가' | '갱신' | '보류'; reasons: string[]; fields?: string[] }[] = [];
  let unchanged = 0;
  for (const row of source) {
    const key = f04DayKey(row);
    const contractKey = f04ContractKey(row);
    const identity = digest([row.contractNo, row.receivedAt, row.plate, row.createdMarker || 'F04:접수']);
    const auditEventId = row.contractNo
      ? 'f04_event_' + identity.slice(0, 32) : intakeEventDocId(row.plate, undefined, row.receivedAt);
    const report = (action: '추가' | '갱신' | '보류', reasons: string[], fields?: string[]) =>
      entries.push({ row: row.sourceRow, action, reasons, ...(fields?.length ? { fields } : {}) });
    if (!row.plate || !isCalendarDay(row.receivedAt) || row.receivedAt > today) {
      report('보류', ['접수일 또는 차량번호 확인 필요']);
      continue;
    }
    if (intakeAuthorityForDate(row.receivedAt) !== 'ADMIN') continue;
    const sameDaySource = sourceKeys.get(key) ?? [];
    if (sameDaySource.length > 1 &&
        (sameDaySource.some(item => !item.contractNo) || sameDaySource.filter(item => f04ContractKey(item) === contractKey).length > 1)) {
      report('보류', ['시트에 같은 차량·접수일·계약번호가 중복되거나 계약번호가 불명확']);
      continue;
    }
    if (row.invalidAmounts.length) {
      report('보류', ['금액·수치 셀 오류: ' + row.invalidAmounts.join(', ')]);
      continue;
    }
    if (row.sentCharge && (!isCalendarDay(row.billedAt) || row.billedAt < row.receivedAt || row.billedAt > today)) {
      report('보류', ['기청구 발송일 확인 필요']);
      continue;
    }
    const sameDayServer = byKey.get(key) ?? [];
    const exact = sameDayServer.filter(item => f04ContractKey(item.data) === contractKey);
    const legacyMatch = sameDaySource.length === 1 && sameDayServer.length === 1 &&
      (!row.contractNo || !verifiedF04Contract(sameDayServer[0].data.contractNo));
    const matches = exact.length ? exact : legacyMatch ? sameDayServer : [];
    if (matches.length > 1 || (!matches.length && sameDayServer.some(item => !verifiedF04Contract(item.data.contractNo)))) {
      report('보류', ['서버에 같은 차량·접수일이 여러 건']);
      continue;
    }
    const existing = matches[0];
    if (existing) {
      const cur = existing.data;
      const managed = (cur._f04Sync ?? {}) as Record<string, string>;
      const started = settlementStartedOf(cur) || row.billed || row.collected || row.paid;
      const patch: Record<string, unknown> = {};
      const next = { ...managed };
      const blocked: string[] = [];
      for (const key of F04_SYNC_FIELDS) {
        const value = row[key];
        if (value === '' || value === null || value === cur[key]) continue;
        if (!started && managed[key] === digest(cur[key])) {
          patch[key] = value;
          next[key] = digest(value);
        } else {
          blocked.push(key);
        }
      }
      const protectedFields = ['claimWritten', 'payWritten', 'customer', 'channel', 'agent', 'note',
        'paper', 'delivered', 'deliveredAt', 'cancelled', 'billed', 'paid', 'collected'] as const;
      for (const key of protectedFields) {
        const value = row[key];
        if (value !== '' && value !== null && value !== cur[key]) blocked.push(key);
      }
      const changed = Object.keys(patch);
      if (changed.length) {
        writes.push({ action: '갱신', id: existing.id, updateTime: existing.updateTime, row: row.sourceRow,
          key, source: row, auditEventId: cellText(cur.auditEventId) ?? auditEventId, data: { ...patch, _f04Sync: next } });
        report('갱신', blocked.length ? ['F04 관리값 갱신, 별도 소유 칸 보존: ' + blocked.join(', ')] : ['F04 관리값 변경'], changed);
      } else if (blocked.length) {
        report('보류', [started && row.cancelled && cur.cancelled !== true ? '환수 확인 필요' : '확정 증적 또는 서버 입력 보존: ' + blocked.join(', ')]);
      } else unchanged++;
      continue;
    }

    const id = intakeCode('', undefined, row.receivedAt, 'f04:' + identity, 'request');
    if (serverIds.has(id)) {
      report('보류', ['문서 열쇠가 다른 접수와 충돌']);
      continue;
    }
    if (server.some(item => possibleF04KeyChange(row, item.data))) {
      report('보류', ['키 변경 또는 Admin 중복 의심: 접수일 3일 이내·같은 영업자·공급사·금액']);
      continue;
    }
    // 원본이 미확정이면 그대로 두고, 이미 확정된 금액의 공백은 사람이 확인한다.
    const inconsistentVat = (amount: number | null, vat: number | null, total: number | null) =>
      amount !== null && (vat !== null && vat !== Math.round(amount * 0.1) ||
        total !== null && total !== amount + Math.round(amount * 0.1));
    if ((row.billed || row.collected) && inconsistentVat(row.claimWritten, row.claimVat, row.claimTotal) ||
        row.paid && inconsistentVat(row.payWritten, row.payVat, row.payTotal)) {
      report('보류', ['기청구·지급액의 부가세 또는 원본 합계 검토 필요']);
      continue;
    }
    if (!row.supplier || !row.customer || !row.channel ||
        (row.delivered && (!isCalendarDay(row.deliveredAt) || row.deliveredAt < row.receivedAt || row.deliveredAt > today)) ||
        ((row.billed || row.collected) && row.claimWritten === null) || (row.paid && row.payWritten === null)) {
      report('보류', ['필수 접수 사실·인도일 또는 확정 금액 확인 필요']);
      continue;
    }
    const financial = {
      claimWritten: row.claimWritten, payWritten: row.payWritten,
      billed: row.billed, billedAt: row.billedAt, paid: row.paid, paidAt: row.paidAt,
      collected: row.collected, collectedAt: row.collectedAt, billMonth: row.billMonth,
      collectedAmt: row.collectedAmt, paidAmt: row.paidAmt,
      claimStage: row.collected ? '수금' : row.billed ? '청구' : '접수',
      payStage: row.paid ? '지급' : '접수',
    };
    const data = {
      ...intakeRecord(row, Date.parse(today + 'T00:00:00+09:00')), ...financial,
      settleNote: '',
      sourceTab: '접수', fromSheet: 'F04 연동', sourceRow: row.sourceRow,
      _f04Sync: Object.fromEntries(F04_SYNC_FIELDS.map(key => [key, digest(row[key])])),
    };
    writes.push({ action: '추가', id, row: row.sourceRow, key, source: row, auditEventId,
      data: { ...data, code: id, auditEventId, contractNo: row.contractNo,
        f04SourceIdentity: identity, cancelled: row.cancelled, stage: row.cancelled ? '취소' : '접수' } });
    serverIds.add(id);
    report('추가', [row.cancelled ? '서버에 없음, 원본 취소 상태와 확인된 값을 복사' : '서버에 없음, 원본 접수·확정값을 복사']);
  }
  const serverOnlyReview = server.flatMap(({ id, data }) => {
    if (!data.f04SourceIdentity && data.fromSheet !== 'F04 연동') return [];
    const sourced = sourceKeys.get(f04DayKey(data)) ?? [];
    const present = sourced.some(row => f04ContractKey(row) === f04ContractKey(data)) ||
      (sourced.length === 1 && !verifiedF04Contract(data.contractNo));
    return present ? [] : [{ reference: digest(id).slice(0, 12), sourceRow: data.sourceRow ?? null, reason: '원천 없음' }];
  });
  return { entries, writes, unchanged, serverOnlyReview, fingerprint: digest({ entries, writes, serverOnlyReview }) };
}
