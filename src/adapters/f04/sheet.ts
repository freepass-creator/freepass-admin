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

/* ══ 수수료표 — ★셈법의 정본 ═════════════════════════════════ */

/**
 * 셈법 일곱 (실측 156줄) —
 *   대여료×기간 80 · 정액 23 · 범위 20 · 차량가액 19 · 구독료+정액 5 · 조건분기 2 · 한달렌탈료 1
 *
 * ★「범위」 와 「구독료+정액」 은 **사람이 정한다**(28줄). 기계가 계산하려 들면 틀린다.
 *   「모른다」가 아니라 **「사람 몫」** 이다 — 둘을 가려 담는다.
 */
export type FeeMethod = '대여료×기간' | '정액' | '범위' | '차량가액' | '구독료+정액' | '조건분기' | '한달렌탈료' | '알 수 없음';

export const FEE_METHODS: FeeMethod[] = [
  '대여료×기간', '정액', '범위', '차량가액', '구독료+정액', '조건분기', '한달렌탈료',
];

export interface FeeRule {
  supplier: string;
  kind: string | null;          // 신차 · 재렌트 · 구독
  form: string | null;          // 선출고 · 매칭출고 · 인수형 …
  term: string | null;          // 「12」 · 「기간 무관」
  method: FeeMethod;
  /** 원문 그대로. ★「최대 9%」 · 「12개월구독료 100% + 30만」 은 수가 아니다 */
  claimRaw: string | null;
  payRaw: string | null;
  /** 수로 읽힌 것만. 못 읽으면 null */
  claimRate: number | null;
  payRate: number | null;
  /** ★기계가 낼 수 있나. 「사람이 정한다」면 계산하지 않는다 */
  byMachine: boolean;
  billWhen: string | null;
  note: string | null;
}

export function methodOf(raw: unknown): FeeMethod {
  const s = String(raw ?? '').trim();
  return (FEE_METHODS as string[]).includes(s) ? s as FeeMethod : '알 수 없음';
}

/** 「0.0475」 · 「600000」 · 「최대 9%」 · 「12개월구독료 100% + 30만」 */
export function feeValueOf(raw: unknown, method: FeeMethod): number | null {
  if (method === '범위' || method === '구독료+정액' || method === '조건분기') return null;  /* ★사람 몫 */
  const n = cellNumber(raw);
  if (n === null) return null;
  return n;
}
