/**
 * **정산 생애주기 — 청구서 발행부터 «돈 받은 것» 까지.**  화면을 모른다. 무엇을 어떻게 바꾸는지만.
 *
 * ★사장님 2026-09-08 「청구까지 완료, 돈 받은 거까지 정산 생애주기를 관리하면 되지」
 * ★대표 2026-09-18 「너는 일단 ssot나 코딩으로 어떻게 할지만 기능만 만들어놔 — 배열은 디자인이」
 * 규칙은 erp4 `settlement-atom.ts`(두 축) · `settlement-invoice-code.ts`(문서번호) · `settlement-money.ts`(부가세)를 따른다.
 *
 * ── 축이 둘이다 (한 낱말로 뭉치면 어긋남이 안 보인다)
 *   청구 축(공급사)    접수 → 청구 → 확인 → 수금        받는 길
 *   지급 축(영업채널)  접수 → 통보 → 확인 → 지급        주는 길
 *   곁길              정정(상대가 다르다고 했다) · 보류(청구 보류) · 취소
 *
 * ── 문서번호 (erp4 규격 · 사장님 2026-08-26 「신규코드 발행 매뉴얼에 따르고」)
 *   공급사 청구서 FP-S-YYYYMM-NNN · 영업채널 지급명세 FP-P-YYYYMM-NNN · 그 달 안에서 순번
 *   ★번호는 «발행할 때» 붙고 안 바뀐다 — 같은 달·같은 축·같은 상대로 다시 발행하면 «같은 번호» 를 다시 쓴다
 *   ★발행 때 합계를 적어 둔다 — 뒤에 원장이 바뀌면 「달라졌다」 고 말할 수 있어야 한다(driftOf)
 *
 * ── 수금·지급은 «통장이 알려 준다»
 *   아직 그 길이 없으니 사람이 찍는다. 안 찍혔으면 「안 받았다」 가 아니라 「아직」 이다.
 */
import { claimAmountOf, payAmountOf } from './money';
import type { Clawback, LedgerLine } from './ledgers';
import type { SettlementRow } from './types';

export const CLAIM_STAGES = ['접수', '청구', '정정', '확인', '수금'] as const;
export const PAY_STAGES = ['접수', '통보', '정정', '확인', '지급'] as const;
export type ClaimStageFull = typeof CLAIM_STAGES[number];
export type PayStageFull = typeof PAY_STAGES[number];
export type Axis = '공급사' | '영업채널';

export const VAT = 0.1;

/** 두 축을 한 낱말로 — 곁길이 먼저, 정정은 어느 쪽이든 정정, 그 다음은 «덜 간 쪽» (erp4 stageOf) */
export function lifeStageOf(claim: string, pay: string, off?: '보류' | '취소' | ''): string {
  if (off) return off;
  if (claim === '정정' || pay === '정정') return '정정';
  const rank = (s: string, order: readonly string[]) => Math.max(0, order.indexOf(s));
  return rank(claim, CLAIM_STAGES) <= rank(pay, PAY_STAGES) ? claim : pay;
}

/* ── 부가세 — 줄마다 가르고 그 다음에 더한다(총액에 곱하면 1원씩 어긋난다 · erp4 2026-09-09) ── */
export function invoiceMoneyOf(amount: number, vatIncluded: boolean): { net: number; vat: number; total: number } {
  const net = vatIncluded ? Math.round(amount / (1 + VAT)) : amount;
  const vat = vatIncluded ? amount - net : Math.round(net * VAT);
  return { net, vat, total: net + vat };
}

/* ── 문서번호 ── */
export const invoiceKey = (month: string, axis: Axis, party: string) => `${month.trim()}|${axis}|${party.trim()}`;
export function nextInvoiceNo(month: string, axis: Axis, taken: readonly string[]): string {
  const head = `FP-${axis === '공급사' ? 'S' : 'P'}-${month.replace(/[^0-9]/g, '').slice(0, 6)}-`;
  const used = taken.filter((v) => v.startsWith(head)).map((v) => Number(v.slice(head.length))).filter((n) => Number.isFinite(n) && n > 0);
  return head + String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0');
}

export interface IssuedInvoice {
  key: string; invoiceNo: string; month: string; axis: Axis; party: string;
  supply: number; vat: number; total: number; lines: number; codes: string[];
  /** 이 장에서 뺀 환수(공급가) — 환수는 «반대 부호의 한 줄» 이다 */
  clawback: number;
  issuedAt: number; issuedBy: string;
  /* ── 청구 링크 (claim-link.ts) — 저장소가 채운다 ── */
  /** 상대 거래처 — 공급사/영업채널 코드 · 등록 상호 · 사업자등록번호(발행 때 굳힘) */
  partyCode?: string; partyName?: string; partyBizNo?: string;
  /** 상대에게 보일 «굳힌 사본» — 그 축의 금액만 */
  snapshot?: { lines: unknown[]; clawbacks: unknown[] };
  linkHash?: string; linkCreatedAt?: number; linkRevokedAt?: number | null;
  failCount?: number; lockedUntil?: number | null;
  openedAt?: number; openCount?: number;
  /** 상대의 답 — 대기 · 확인 · 이의 */
  response?: { state: '확인' | '이의'; at: number; memo?: string; codes?: string[] };
}

/** 발행 뒤 원장이 바뀌었나 — ★조용히 다른 금액을 인쇄하지 않는다 */
export function driftOf(issued: IssuedInvoice | null, now: { supply: number; vat: number; lines: number }): string | null {
  if (!issued) return null;
  const d: string[] = [];
  if (issued.lines !== now.lines) d.push(`줄 ${issued.lines} → ${now.lines}`);
  if (issued.supply !== now.supply) d.push(`공급가 ${issued.supply.toLocaleString()} → ${now.supply.toLocaleString()}`);
  if (issued.vat !== now.vat) d.push(`부가세 ${issued.vat.toLocaleString()} → ${now.vat.toLocaleString()}`);
  return d.length ? `발행 뒤 원장이 바뀌었다 — ${d.join(' · ')}` : null;
}

/**
 * **청구서(또는 지급명세) 발행 계획** — 한 달 · 한 축 · 한 상대의 줄들.
 * ★막는 것: 「청구월 미정」 · 금액 모름이 섞인 묶음 · 끊긴 분납은 받은 몫으로 이미 셈해져 있다(money.ts).
 * ★보류 줄은 금액 0 으로 실리지 않는다(청구 축) — 빼고 발행한다.
 */
export function planInvoice(
  month: string, axis: Axis, party: string, lines: readonly LedgerLine[], clawbacks: readonly Clawback[],
  existing: IssuedInvoice | null, takenNos: readonly string[], now: number, by: string,
): { ok: true; invoice: IssuedInvoice; patches: { code: string; patch: Record<string, unknown>; events: { field: string; from: string; to: string }[] }[] }
  | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: '청구월이 정해진 달에서만 발행합니다 — 「청구월 미정」 줄은 먼저 달을 정합니다' };
  const live = lines.filter((l) => !(axis === '공급사' && l.row.progress.billHold));
  if (!live.length) return { ok: false, error: '발행할 줄이 없습니다' };
  const unknown = live.filter((l) => l.amount === null);
  if (unknown.length) return { ok: false, error: `금액 모름 ${unknown.length}줄 — 금액을 먼저 정해야 발행합니다` };
  const corr = live.filter((l) => (axis === '공급사' ? l.row.claimStage : l.row.payStage) === '정정');
  if (corr.length) return { ok: false, error: `정정 중인 줄 ${corr.length} — 정정을 먼저 풉니다` };
  const cashMoved = live.filter((l) => axis === '공급사'
    ? l.row.progress.collected || (l.row.progress.collectedAmt ?? 0) > 0
    : l.row.progress.paid || (l.row.progress.paidAmt ?? 0) > 0);
  if (cashMoved.length) return { ok: false, error: `이미 ${axis === '공급사' ? '수금' : '지급'}이 시작된 줄 ${cashMoved.length} — 문서를 다시 발행하지 않고 정정/환수로 처리합니다` };
  if (axis === '공급사' && live.some((l) => l.row.progress.invoiceIssued)) {
    return { ok: false, error: '계산서가 처리된 줄은 청구서를 다시 발행할 수 없습니다 — 정정/가감 절차를 사용합니다' };
  }

  let supply = 0, vat = 0;
  for (const l of live) { const m = invoiceMoneyOf(l.amount ?? 0, l.row.money.vatIncluded); supply += m.net; vat += m.vat; }
  /* 환수 — 공급가로 적힌 값에 부가세를 붙여 뺀다 (erp4 clawMoneyOf) */
  let clawback = 0;
  for (const c of clawbacks) {
    if (c.month !== month) continue;
    const amt = axis === '공급사' ? (c.supplier === party ? c.supplierAmt : 0) : (c.channel === party ? c.agentAmt : 0);
    if (!amt) continue;
    clawback += amt; supply -= amt; vat -= Math.round(amt * VAT);
  }
  const day = new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
  const invoice: IssuedInvoice = {
    key: invoiceKey(month, axis, party),
    invoiceNo: existing?.invoiceNo ?? nextInvoiceNo(month, axis, takenNos),
    month, axis, party, supply, vat, total: supply + vat, lines: live.length, codes: live.map((l) => l.row.id), clawback,
    issuedAt: now, issuedBy: by,
  };
  const patches = live.map((l) => {
    const r = l.row;
    const patch: Record<string, unknown> = { billMonth: month };   // ★발행한 달에 박는다 — 이제 이 달은 닫힌다
    const events: { field: string; from: string; to: string }[] = [];
    if (r.progress.billMonth !== month) events.push({ field: '청구월', from: r.progress.billMonth ?? '', to: month });
    if (axis === '공급사') {
      if (!r.progress.billed) { patch.billed = true; patch.billedAt = day; events.push({ field: '청구서', from: 'false', to: invoice.invoiceNo }); }
      if (r.claimStage === '접수') { patch.claimStage = '청구'; events.push({ field: '청구 축', from: '접수', to: '청구' }); }
      else if (existing && r.claimStage === '확인') {
        patch.supplierOk = false; patch.claimStage = '청구';
        events.push({ field: '청구 재발행', from: '확인', to: '청구 재확인 필요' });
      }
    } else if (r.payStage === '접수') {
      patch.payStage = '통보'; events.push({ field: '지급 축', from: '접수', to: '통보' });
    } else if (existing && r.payStage === '확인') {
      patch.channelOk = false; patch.payStage = '통보';
      events.push({ field: '지급명세 재발행', from: '확인', to: '통보 재확인 필요' });
    }
    return { code: r.id, patch, events };
  });
  return { ok: true, invoice, patches };
}

/** 환수 포함 묶음은 행별 현금 배분 정책이 확정되기 전까지 개별 행 수금/지급을 잠근다. */
export function invoiceNeedsCashAllocation(inv: IssuedInvoice | null | undefined): boolean {
  if (!inv) return false;
  return (inv.clawback ?? 0) > 0 || (inv.snapshot?.clawbacks?.length ?? 0) > 0;
}

/** 실제 통장 기준 목표/남은 금액 — 공급가가 아니라 부가세 포함 실제 현금 기준. */
export function cashTargetOf(axis: Axis, r: SettlementRow): number | null {
  const base = axis === '공급사' ? claimAmountOf(r) : payAmountOf(r);
  if (base === null) return null;
  return Math.max(0, invoiceMoneyOf(base, r.money.vatIncluded).total);
}

export function cashRemainingOf(axis: Axis, r: SettlementRow): number | null {
  const target = cashTargetOf(axis, r);
  if (target === null) return null;
  const done = axis === '공급사' ? (r.progress.collectedAmt ?? 0) : (r.progress.paidAmt ?? 0);
  return Math.max(0, target - Math.max(0, done));
}

/* ── 한 줄의 다음 걸음 ── */
export type LifeChange =
  | { kind: 'confirm'; axis: Axis }                                         // 상대가 확인했다
  | { kind: 'correct'; axis: Axis; amount: number | null; memo: string }    // 상대가 다르다고 했다
  | { kind: 'uncorrect'; axis: Axis }                                       // 정정을 풀었다(맞췄다)
  | { kind: 'invoice'; on: boolean; biz?: string; day?: string }            // 계산서를 끊었다
  | { kind: 'collected'; amount: number; day: string }                      // 공급사에게 받았다
  | { kind: 'paid'; amount: number; day: string }                           // 영업채널에 줬다
  | { kind: 'hold'; on: boolean }                                           // 청구 보류
  | { kind: 'billMonth'; month: string };                                   // 청구월을 사람이 정한다(청구월 미정 줄)

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export function lifePatch(r: SettlementRow, c: LifeChange):
  { ok: true; patch: Record<string, unknown>; events: { field: string; from: string; to: string }[] } | { ok: false; error: string } {
  if (r.progress.cancelled) return { ok: false, error: '취소된 줄입니다' };
  const ev = (field: string, from: unknown, to: unknown) => ({ field, from: String(from ?? ''), to: String(to ?? '') });

  switch (c.kind) {
    case 'confirm': {
      const [stage, ok, fix] = c.axis === '공급사' ? [r.claimStage, 'supplierOk', 'supplierFix'] : [r.payStage, 'channelOk', 'channelFix'];
      if (stage === '접수') return { ok: false, error: c.axis === '공급사' ? '청구서가 아직 안 나갔습니다' : '아직 통보 전입니다' };
      if (stage === '확인' || stage === '수금' || stage === '지급') return { ok: true, patch: {}, events: [] };
      if (stage === '정정') return { ok: false, error: '정정 중입니다 — 정정을 먼저 풀어야 확인할 수 있습니다' };
      const expected = c.axis === '공급사' ? '청구' : '통보';
      if (stage !== expected) return { ok: false, error: `${expected} 단계에서만 확인할 수 있습니다` };
      const axisKey = c.axis === '공급사' ? 'claimStage' : 'payStage';
      return { ok: true, patch: { [ok]: true, [fix]: false, [axisKey]: '확인' }, events: [ev(`${c.axis} 확인`, stage, '확인')] };
    }
    case 'correct': {
      const stage = c.axis === '공급사' ? r.claimStage : r.payStage;
      if (stage === '접수') return { ok: false, error: '아직 상대에게 안 나갔습니다 — 정정할 것이 없습니다' };
      if (stage === '수금' || stage === '지급') return { ok: false, error: '이미 돈 처리가 끝난 줄입니다 — 정정이 아니라 환수/가감으로 처리합니다' };
      if (!c.memo.trim()) return { ok: false, error: '정정 사유(상대가 뭐라고 했는지)를 적어야 합니다' };
      const p = c.axis === '공급사'
        ? { supplierFix: true, supplierOk: false, supplierFixAmt: c.amount ?? 0, supplierMemo: c.memo.trim(), claimStage: '정정' }
        : { channelFix: true, channelOk: false, channelFixAmt: c.amount ?? 0, channelMemo: c.memo.trim(), payStage: '정정' };
      return { ok: true, patch: p, events: [ev(`${c.axis} 정정`, stage, `정정 ${c.amount ?? ''} ${c.memo.trim()}`.trim())] };
    }
    case 'uncorrect': {
      const stage = c.axis === '공급사' ? r.claimStage : r.payStage;
      if (stage !== '정정') return { ok: true, patch: {}, events: [] };
      /* ★정정 금액은 «지우지 않는다» — 무엇을 요청받았는지 남는다. 금액을 고치려면 가감(adjust)으로 */
      const back = c.axis === '공급사' ? { supplierFix: false, claimStage: '청구' } : { channelFix: false, payStage: '통보' };
      return { ok: true, patch: back, events: [ev(`${c.axis} 정정 풂`, '정정', c.axis === '공급사' ? '청구' : '통보')] };
    }
    case 'invoice': {
      const biz = String(c.biz ?? '').replace(/\D/g, '');
      if (c.on && !r.progress.billed) return { ok: false, error: '청구서가 나간 뒤에 계산서를 끊습니다' };
      if (c.on && r.claimStage === '정정') return { ok: false, error: '정정 중에는 계산서를 끊을 수 없습니다' };
      if (c.on && !r.progress.invoiceIssued && r.claimStage !== '확인') return { ok: false, error: '공급사 확인이 끝난 뒤에 계산서를 끊습니다' };
      if (!c.on && (r.progress.collected || (r.progress.collectedAmt ?? 0) > 0)) return { ok: false, error: '수금이 시작된 줄의 계산서는 되돌릴 수 없습니다' };
      if (c.on && c.day && !DAY.test(c.day)) return { ok: false, error: '계산서 날짜는 YYYY-MM-DD' };
      if (c.on && biz.length !== 10) return { ok: false, error: '계산서 사업자번호는 숫자 10자리로 넣습니다' };
      if (r.progress.invoiceIssued === c.on) return { ok: true, patch: {}, events: [] };
      return {
        ok: true,
        patch: c.on ? { invoiceIssued: true, invoiceAt: c.day ?? '', invoiceBiz: biz } : { invoiceIssued: false },
        events: [ev('계산서', r.progress.invoiceIssued, c.on ? `${c.day ?? ''} ${biz}`.trim() || 'true' : 'false')],
      };
    }
    case 'collected': {
      if (!r.progress.billed) return { ok: false, error: '청구서가 나간 뒤에 수금을 찍습니다' };
      if (r.claimStage !== '확인') return { ok: false, error: '공급사 확인이 끝난 뒤에 수금을 찍습니다' };
      if (!r.progress.invoiceIssued) return { ok: false, error: '계산서를 끊은 뒤에 수금을 찍습니다' };
      if (!DAY.test(c.day)) return { ok: false, error: '받은 날은 YYYY-MM-DD' };
      const target = cashTargetOf('공급사', r);
      if (target === null) return { ok: false, error: '청구금액을 모르는 줄은 수금을 찍을 수 없습니다' };
      const before = Math.max(0, r.progress.collectedAmt ?? 0);
      if (!Number.isFinite(c.amount) || c.amount < 0 || (before < target && c.amount <= 0)) return { ok: false, error: '이번에 받은 금액을 넣어야 합니다' };
      const amount = Math.round(c.amount);
      const total = before + amount;
      const done = total >= target;
      return {
        ok: true,
        patch: { collected: done, collectedAt: c.day, collectedAmt: total, claimStage: done ? '수금' : '확인' },
        events: [ev(done ? '수금' : '부분수금', before, `${total}/${target} (+${amount}, ${c.day})`)],
      };
    }
    case 'paid': {
      if (r.payStage === '접수') return { ok: false, error: '통보 전입니다 — 지급명세를 먼저 냅니다' };
      if (r.payStage !== '확인') return { ok: false, error: '영업채널 확인이 끝난 뒤에 지급을 찍습니다' };
      if (!DAY.test(c.day)) return { ok: false, error: '준 날은 YYYY-MM-DD' };
      const target = cashTargetOf('영업채널', r);
      if (target === null) return { ok: false, error: '지급금액을 모르는 줄은 지급을 찍을 수 없습니다' };
      const before = Math.max(0, r.progress.paidAmt ?? 0);
      if (!Number.isFinite(c.amount) || c.amount < 0 || (before < target && c.amount <= 0)) return { ok: false, error: '이번에 준 금액을 넣어야 합니다' };
      const amount = Math.round(c.amount);
      const total = before + amount;
      const done = total >= target;
      return {
        ok: true,
        patch: { paid: done, paidAt: c.day, paidAmt: total, payStage: done ? '지급' : '확인' },
        events: [ev(done ? '지급' : '부분지급', before, `${total}/${target} (+${amount}, ${c.day})`)],
      };
    }
    case 'hold': {
      if (c.on && r.progress.billed) return { ok: false, error: '청구서가 나간 줄은 보류할 수 없습니다 — 정정으로' };
      if (r.progress.billHold === c.on) return { ok: true, patch: {}, events: [] };
      return { ok: true, patch: { billHold: c.on }, events: [ev('청구 보류', r.progress.billHold, c.on)] };
    }
    case 'billMonth': {
      if (!MONTH.test(c.month)) return { ok: false, error: '청구월은 YYYY-MM' };
      if (r.progress.billed) return { ok: false, error: '청구서가 나간 줄은 달을 못 바꿉니다' };
      if (!r.progress.delivered) return { ok: false, error: '인도 전 줄은 청구월이 없습니다 — 인도를 먼저 찍습니다' };
      if (r.progress.billMonth === c.month) return { ok: true, patch: {}, events: [] };
      return { ok: true, patch: { billMonth: c.month }, events: [ev('청구월', r.progress.billMonth ?? '', c.month)] };
    }
  }
}

/** 청구서에 실릴 줄의 금액 — 화면이 미리보기를 그릴 때도 이걸 쓴다 */
export const lineAmountOf = (axis: Axis, r: SettlementRow, now = new Date()) =>
  axis === '공급사' ? claimAmountOf(r, now) : payAmountOf(r, now);
