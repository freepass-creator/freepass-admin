/**
 * **수수료 셈 — 규칙은 «데이터» 로 받는다.**
 *
 * ★대표 2026-09-18 「수수료 계산하는 방식이랑 이런것들 다 학습해서 원자로 갖고와 … ssot에 반영되어야할거」
 *   규칙의 정본은 이제 ERP5 `settlement_fee_rules`(한 규칙 = 한 문서) · `settlement_rules/current`(갈래·별칭·시점)다.
 *   이 파일은 규칙을 «모른다» — 받은 규칙으로 셀 뿐이다. 규칙이 바뀌면 ERP5 문서만 고친다.
 *
 * ★셈법·찾는 차례는 erp4 `lib/domain/settlement-fee-table.ts`(박태윤 매니저가 정한 표) ·
 *   `scripts/check-fee-consistency.mts` 와 «같다». 옮기면서 바꾼 것은 없다.
 *
 * ★★`auto: false` 규칙은 기계가 금액을 내지 «않는다» — 「건별 책정」·「최대 9%」 는 사람이 정한다.
 *   가장 비슷한 규칙에 끼워 넣어 세면 조용한 오답이 된다(erp4 2026-09-08 신차발주 사고).
 */
import type { Maybe } from './types';

export type FeeBasis = '차량가액' | '대여료×기간' | '정액' | '한달렌탈료' | '구독료+정액' | '범위' | '조건분기';
export type FeeKind = '신차' | '재렌트' | '구독' | '전기차';

export interface FeeRule {
  id: string;
  supplier: string;
  kind: FeeKind;
  form: string;        // 선출고 · 선발주 · 발주 · 매칭출고 · 인수형 · 인수,반납형 · ''
  term: number;        // 0 = 기간 무관
  basis: FeeBasis;
  claim: number | string;   // 숫자면 율(0.035) 또는 정액(600000) · 글이면 사람이 정한다
  pay: number | string;
  when: string;
  auto: boolean;
  note?: string;
}

/** 갈래 가르기 한 줄 — 위에서부터 처음 맞는 것. `evKind` 가 있으면 전기차일 때 그리로 */
export interface KindRule { match: string; kind: FeeKind; form?: string; evKind?: FeeKind; evFallback?: FeeKind }

export interface FeeRuleSet {
  rules: FeeRule[];
  aliases: Record<string, string>;
  evModel: string;        // 정규식 글자
  kindRules: KindRule[];
  version: string;
}

/** 이름 앞머리 — 원장은 줄여 적고 표는 정식 상호다 (erp4 HEAD 와 같음) */
export const headOf = (s: string) => s.replace(/\s|주식회사|㈜|렌터카|렌트카|모빌리티|\(.*\)/g, '');

export function feeKindOf(set: FeeRuleSet, product: string, model: string): { kind: FeeKind; form?: string; fallback?: FeeKind } {
  const ev = new RegExp(set.evModel, 'i').test(model);
  for (const k of set.kindRules) {
    if (!new RegExp(k.match).test(product)) continue;
    if (ev && k.evKind) return { kind: k.evKind, fallback: k.evFallback };
    return { kind: k.kind, ...(k.form ? { form: k.form } : {}) };
  }
  /* 어느 말에도 안 걸리면 재렌트 (erp4 마지막 줄) */
  return ev ? { kind: '전기차', fallback: '재렌트' } : { kind: '재렌트' };
}

/**
 * 규칙 찾기 — ① 공급사+형태+기간 ② 기간무관 ③ 형태 무시 ④ 전기차 특약이 없으면 일반 갈래로.
 * ★특약이 없으면 «없는 것» 이 아니라 «일반 규칙» 이다 (erp4 2026-09-01 모델Y 사고).
 */
export function feeRuleFor(set: FeeRuleSet, supplier: string, kind: FeeKind, term: number, form?: string, fallback?: FeeKind): FeeRule | undefined {
  const s = headOf(supplier);
  if (!s) return undefined;
  const names = [s, set.aliases[supplier] ? headOf(set.aliases[supplier]) : ''].filter(Boolean);
  const mine = set.rules.filter((r) => { const t = headOf(r.supplier); return t && names.some((n) => n.startsWith(t) || t.startsWith(n)); });
  if (!mine.length) return undefined;
  const pick = (k: FeeKind) => {
    const byForm = form ? mine.filter((r) => r.form === form) : mine;
    return byForm.find((r) => r.kind === k && r.term === term)
      || byForm.find((r) => r.kind === k && r.term === 0)
      || mine.find((r) => r.kind === k && r.term === term)
      || mine.find((r) => r.kind === k && r.term === 0);
  };
  return pick(kind) || (fallback ? pick(fallback) : undefined);
}

export type FeeResult =
  | { status: 'AUTO'; rule: FeeRule; claim: number; pay: number }
  | { status: 'MANUAL'; rule: FeeRule; why: string }        // 사람이 정하는 규칙
  | { status: 'NO_RULE'; why: string }                      // 표에 그 공급사·갈래가 없다
  | { status: 'NO_BASE'; rule: FeeRule; why: string };      // 셀 밑값(대여료·기간·차량가액)이 없다

/**
 * 한 계약의 수수료 — 비율(settleRatio)·정산대상은 여기서 안 본다. 그건 청구목록 셈(ledgers.ts)의 몫이다.
 * ★밑값이 없으면 0 으로 세지 않는다 — NO_BASE 로 돌려 「모름」 이 되게 한다.
 */
export function feeOf(
  set: FeeRuleSet,
  c: { supplier: Maybe<string>; product: Maybe<string>; model: Maybe<string>; term: Maybe<number>; rent: Maybe<number>; price: Maybe<number> },
): FeeResult {
  const { kind, form, fallback } = feeKindOf(set, c.product ?? '', c.model ?? '');
  const term = c.term ?? 0;
  const rule = feeRuleFor(set, c.supplier ?? '', kind, term, form, fallback);
  if (!rule) return { status: 'NO_RULE', why: `표에 「${c.supplier ?? '(공급사 없음)'} · ${kind}${form ? ` ${form}` : ''}${term ? ` ${term}개월` : ''}」 가 없다` };
  if (!rule.auto || typeof rule.claim !== 'number' || typeof rule.pay !== 'number') {
    return { status: 'MANUAL', rule, why: `표가 「${rule.claim}」 — 사람이 정한다` };
  }

  const supportedAuto = rule.basis === '정액' || rule.basis === '차량가액' || rule.basis === '대여료×기간';
  if (!supportedAuto) {
    return { status: 'MANUAL', rule, why: `자동 셈으로 지원하지 않는 「${rule.basis}」 규칙입니다 — 사람이 확인합니다` };
  }

  if (rule.basis === '정액') {
    if (![rule.claim, rule.pay].every((v) => Number.isFinite(v) && v >= 0)) {
      return { status: 'MANUAL', rule, why: '정액 수수료 규칙 값이 비정상입니다 — 사람이 확인합니다' };
    }
    return { status: 'AUTO', rule, claim: Math.round(rule.claim), pay: Math.round(rule.pay) };
  }

  if (![rule.claim, rule.pay].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
    return { status: 'MANUAL', rule, why: '비율 수수료 규칙은 0~100% 범위여야 합니다 — 사람이 확인합니다' };
  }

  const base = rule.basis === '차량가액'
    ? c.price
    : (c.rent !== null && c.term !== null ? c.rent * c.term : null);
  if (base === null || !Number.isFinite(base) || base <= 0) {
    return { status: 'NO_BASE', rule, why: rule.basis === '차량가액' ? '차량가액이 없다' : '대여료·계약기간이 없다' };
  }
  return { status: 'AUTO', rule, claim: Math.round(base * rule.claim), pay: Math.round(base * rule.pay) };
}
