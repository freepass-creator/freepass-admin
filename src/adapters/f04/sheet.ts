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

/** 기존 34열 월별 청구표에 누적 접수를 직접 연결한다. 발행/수금 상태를 생성하지 않는다. */
export function intakeBillingFormula(head: string[], month: string, previews: readonly {
  plate: string; receivedAt: number | string; ruleRow: number; basis: '정액' | '차량가액' | '대여료×기간';
}[] = []): string {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('청구월 형식');
  const idx = (name: string) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`접수 필수 열 없음: ${name}`);
    return i + 1;
  };
  const c = (name: string) => `CHOOSECOLS(src,${idx(name)})`;
  const columnName = (index: number): string => {
    let name = '';
    for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
    return name;
  };
  const endColumn = columnName(Math.max(54, head.length));
  const claimColumn = columnName(idx('판매수수료'));
  const [year, mo] = month.split('-').map(Number);
  const claim = c('판매수수료'), pay = c('출고수수료');
  const cv = `IF(candidate="","",ROUND(candidate*0.1,0))`;
  const pv = `IF(${pay}="","",ROUND(${pay}*0.1,0))`;
  const basis = `MAP(ROW('접수'!A3:A),LAMBDA(ix,IF(INDEX('접수'!${claimColumn}:${claimColumn},ix)="","HOLD — 산정 조건 확인",IFERROR(FORMULATEXT(INDIRECT("'접수'!${claimColumn}"&ix)),"정액/확정 기재 공급가액 "&TEXT(INDEX('접수'!${claimColumn}:${claimColumn},ix),"#,##0"))&"; 부가세 = ROUND(공급가액 × 10%)")))`;
  let estimate = `IF(${claim}="","",${claim})`, explanation = basis;
  for (const preview of [...previews].reverse()) {
    if (!Number.isInteger(preview.ruleRow) || preview.ruleRow < 3) throw new Error('수수료표 참조 행');
    const match = `(${c('차량번호')}=${JSON.stringify(preview.plate)})*(${c('접수일')}=${JSON.stringify(preview.receivedAt)})*(${claim}="")`;
    const rate = `'수수료표'!F${preview.ruleRow}`;
    const base = preview.basis === '차량가액' ? `VALUE(SUBSTITUTE(${c('차량가액')},",",""))`
      : preview.basis === '대여료×기간' ? `${c('렌탈료')}*${c('계약기간')}` : '1';
    const calc = `ROUND(${base}*${rate},0)`;
    const how = preview.basis === '정액' ? `"정액 "&TEXT(${rate},"#,##0")`
      : preview.basis === '차량가액' ? `"차량가액 "&TEXT(${base},"#,##0")&" × "&TEXT(${rate},"0.00%")`
        : `"렌탈료 "&TEXT(${c('렌탈료')},"#,##0")&" × "&${c('계약기간')}&"개월 × "&TEXT(${rate},"0.00%")`;
    estimate = `IF(${match},${calc},${estimate})`;
    explanation = `IF(${match},"표 기준 예상(유효시점 미확인): "&${how}&" = "&TEXT(${calc},"#,##0")&"원",${explanation})`;
  }
  const status = `IF(${c('청구')}=TRUE,"기청구 — 재발행 금지",IF(REGEXMATCH(${c('비고')}&"","8월로 나갔다|이미 청구|청구보류|정산제외"),"HOLD — 기청구/보류 메모 확인",IF(${c('인도일')}="","HOLD — 실제 인도일 확인",IF(${claim}="","HOLD — 공급사 청구액 미확정",IF((${pay}<>"")*(${pay}>${claim}),"HOLD — 역마진/예외 확인",IF(ISNUMBER(${c('청구가감')})*(${c('청구가감')}<>0),"HOLD — 청구가감 적용 확인","청구 검토대상 — 미발송"))))))`;
  const fields = [c('접수일'), c('차량번호'), c('모델명'), c('고객명'), c('공급사'), c('영업채널'),
    c('영업담당자'), c('상품구분'), c('계약기간'), c('렌탈료'), c('인도일'), `IF(${c('차량번호')}<>"","청구","")`,
    c('공급사수수료율'), 'candidate', cv, `IF(candidate="","",candidate+${cv})`, c('에이전시수수료율'), pay, pv,
    `IF(${pay}="","",${pay}+${pv})`, `IF((${claim}="")+(${pay}=""),"",${claim}-${pay})`,
    `IF((${claim}="")+(${pay}="")+(${claim}=0),"",(${claim}-${pay})/${claim})`,
    `IF(${c('차량번호')}<>"","모두","")`, `IF(${c('차량번호')}<>"",1,"")`, c('청구'), c('수금'),
    `IF(${claim}="","금액 미확정","접수 확정기재액 / 금액 셀 수식·메모 확인")`,
    explanation,
    'candidate', `IF(ISNUMBER(${c('청구가감')}),${c('청구가감')},"")`, c('가감사유'), c('비고'), `"접수!A"&ROW('접수'!A3:A)&":${endColumn}"&ROW('접수'!A3:A)`, status];
  const clean = fields.map((f) => f.startsWith('CHOOSECOLS') ? `IF(${f}="","",${f})` : f);
  const yearCol = c('청구년'), monthCol = c('청구월');
  // Explicit year/month only: an invalid or blank year is never silently filled with the current year.
  return `=ARRAYFORMULA(LET(src,'접수'!A3:${endColumn},candidate,${estimate},body,HSTACK(${clean.join(',')}),IFNA(CHOOSECOLS(SORT(FILTER(HSTACK(body,IF(${c('공급사')}="오토플러스",1,0),IFERROR(IF(ISNUMBER(${c('접수일')}),${c('접수일')},DATEVALUE(${c('접수일')})),999999)),IFERROR(VALUE(${yearCol})=${year},FALSE),IFERROR(VALUE(${monthCol})=${mo},FALSE),${c('인도완료')}=TRUE,${c('취소')}<>TRUE,${c('차량번호')}<>""),35,TRUE,36,TRUE),${Array.from({ length: 34 }, (_, i) => i + 1).join(',')}),"")))`;
}

export function intakeSourceRows(raw: unknown[][], headerIndex: number) {
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
        if (seen.has(key)) throw new Error(`접수 원장 중복: row ${r.sourceRow}`);
        seen.add(key);
      }
      return r;
    });
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
