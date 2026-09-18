'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { settlements, today } from '../../server/erp5';
import { loadFeeRuleSet } from '../../adapters/erp5/fee-rules';
import { feeOf } from '../../domain/settlement/fee';
import { WriteDisabledError } from '../../adapters/erp5/settlement-repository';
import { validateIntake, type IntakeInput, type ProgressChange } from '../../domain/settlement/intake';
import type { Axis, LifeChange } from '../../domain/settlement/lifecycle';
import { adjustPatch, adjustmentFromInput, promotionFromInput, promotionPatch } from '../../domain/settlement/adjust';

/**
 * 화면 → 원장. ★여기는 «받아서 넘기기» 만 한다. 규칙은 domain/settlement/intake.ts 가 쥔다.
 */
export type FormState = { errors: string[] };

const S = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const N = (f: FormData, k: string) => {
  const t = S(f, k).replace(/[,\s원]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export async function createIntakeAction(_: FormState, f: FormData): Promise<FormState> {
  const input: IntakeInput = {
    receivedAt: S(f, 'receivedAt'), plate: S(f, 'plate'), model: S(f, 'model'),
    supplier: S(f, 'supplier'), supplierCode: S(f, 'supplierCode'),
    customer: S(f, 'customer'),
    channel: S(f, 'channel'), channelCode: S(f, 'channelCode'),
    agent: S(f, 'agent'), agentCode: S(f, 'agentCode'),
    product: S(f, 'product'), rentKind: S(f, 'rentKind'), contractType: S(f, 'contractType'),
    term: N(f, 'term'), rent: N(f, 'rent'), deposit: N(f, 'deposit'), price: N(f, 'price'),
    payKind: S(f, 'payKind'),
    paper: f.get('paper') === 'on', delivered: f.get('delivered') === 'on', deliveredAt: S(f, 'deliveredAt'),
    note: S(f, 'note'),
    /* 프로모션 — 금액 · 영업자 몫(%) · 사유. ★몫을 비우면 100% (대표 「기본 100%」) */
    promotion: promotionFromInput(f.get('promoAmount'), f.get('promoSharePct'), S(f, 'promoReason')),
    /* 수수료 직접 입력 — 비우면 표대로 */
    ...((S(f, 'feeClaim') || S(f, 'feePay')) ? { feeManual: { claim: N(f, 'feeClaim'), pay: N(f, 'feePay'), reason: S(f, 'feeReason') } } : {}),
  };
  const errors = validateIntake(input, today());
  if (errors.length) return { errors };

  let res: { code: string; created: boolean };
  try { res = await settlements.createIntake(input); }
  catch (e) {
    return { errors: [e instanceof WriteDisabledError ? e.message : `저장하지 못했습니다 — ${(e as Error).message}`] };
  }
  revalidatePath('/intake');
  /*
   * ★이미 있던 줄이면 새로 안 만들고 그 줄로 보낸다 (대표 「있으면 안 올리면 되잖아」)
   * ★계약접수 쪽을 떠나지 않는다 — 대표 «절대 법칙» 「상단 메뉴를 누르지 않는 이상 다른 페이지로 가지 않는다」.
   *   오른쪽 판만 방금 만든 접수로 바뀐다 (/intake?ic=… — 디자인 세션과 맞춘 주소)
   */
  redirect(`/intake?ic=${encodeURIComponent(res.code)}&${res.created ? 'created=1' : 'exists=1'}`);
}

export async function progressAction(_: FormState, f: FormData): Promise<FormState> {
  const code = S(f, 'code');
  const kind = S(f, 'kind');
  const on = S(f, 'on') === '1';
  let change: ProgressChange;
  if (kind === 'paidRounds') {
    const t = S(f, 'rounds');
    change = { kind, rounds: t ? Number(t) : null };
  } else if (kind === 'paper') change = { kind, on };
  else if (kind === 'delivered') change = { kind, on, deliveredAt: S(f, 'deliveredAt') };
  else if (kind === 'cancelled') change = { kind, on, reason: S(f, 'reason') };
  else return { errors: [`모르는 진행 칸: ${kind}`] };

  try {
    const r = await settlements.setProgress(code, change);
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [e instanceof WriteDisabledError ? e.message : `저장하지 못했습니다 — ${(e as Error).message}`] };
  }
  revalidatePath(`/intake/${code}`);
  revalidatePath('/intake');
  return { errors: [] };
}

/**
 * 프로모션 · 가감 — 접수 뒤에 얹거나 고친다. 폼 칸:
 *   code · promoAmount · promoSharePct(0~100, 비우면 100) · promoReason · claimAdjust · payAdjust · adjustReason
 * ★보낸 칸만 고친다 — 프로모션 칸이 없으면 프로모션을, 가감 칸이 없으면 가감을 안 건드린다.
 */
export async function moneyAction(_: FormState, f: FormData): Promise<FormState> {
  const code = S(f, 'code');
  const patch: Record<string, unknown> = {};
  if (f.has('promoAmount')) {
    const p = promotionFromInput(f.get('promoAmount'), f.get('promoSharePct'), S(f, 'promoReason'));
    if (p.amount && p.agentShare === null) return { errors: ['프로모션 영업자 몫은 0~100% 로 넣습니다'] };
    Object.assign(patch, promotionPatch(p));
  }
  if (f.has('claimAdjust') || f.has('payAdjust')) {
    const a = adjustmentFromInput(f.get('claimAdjust'), f.get('payAdjust'), f.get('adjustReason'));
    if (!a.ok) return { errors: [a.error] };
    Object.assign(patch, adjustPatch(a.adjust));
  }
  try {
    const r = await settlements.setMoney(code, patch);
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [e instanceof WriteDisabledError ? e.message : `저장하지 못했습니다 — ${(e as Error).message}`] };
  }
  revalidatePath('/intake');
  revalidatePath('/settlement');
  return { errors: [] };
}

/**
 * 청구서(공급사) · 지급명세(영업채널) 발행. 폼 칸: month(YYYY-MM) · axis(공급사|영업채널) · party
 * ★발행하면 그 줄들의 청구월이 박히고(달이 닫힌다) 청구 축은 「청구」, 지급 축은 「통보」 로 간다.
 */
export async function issueInvoiceAction(_: FormState, f: FormData): Promise<FormState & { invoiceNo?: string }> {
  const axis = S(f, 'axis') as Axis;
  if (axis !== '공급사' && axis !== '영업채널') return { errors: ['축은 공급사 또는 영업채널'] };
  try {
    const r = await settlements.issueInvoice(S(f, 'month'), axis, S(f, 'party'));
    if (!r.ok) return { errors: [r.error] };
    revalidatePath('/settlement');
    revalidatePath('/intake');
    return { errors: [], invoiceNo: r.invoice.invoiceNo };
  } catch (e) {
    return { errors: [e instanceof WriteDisabledError ? e.message : `발행하지 못했습니다 — ${(e as Error).message}`] };
  }
}

/**
 * 한 줄의 다음 걸음. 폼 칸: code · kind 와 그에 딸린 칸
 *   confirm(axis) · correct(axis, amount, memo) · uncorrect(axis) · invoice(on=1|0, biz, day)
 *   collected(amount, day) · paid(amount, day) · hold(on=1|0) · billMonth(month)
 */
export async function lifecycleAction(_: FormState, f: FormData): Promise<FormState> {
  const kind = S(f, 'kind');
  const axis = S(f, 'axis') as Axis;
  const num = (k: string) => { const t = S(f, k).replace(/[,\s원]/g, ''); return t ? Number(t) : NaN; };
  let change: LifeChange;
  switch (kind) {
    case 'confirm': case 'uncorrect':
      if (axis !== '공급사' && axis !== '영업채널') return { errors: ['축은 공급사 또는 영업채널'] };
      change = { kind, axis }; break;
    case 'correct':
      if (axis !== '공급사' && axis !== '영업채널') return { errors: ['축은 공급사 또는 영업채널'] };
      change = { kind, axis, amount: S(f, 'amount') ? num('amount') : null, memo: S(f, 'memo') }; break;
    case 'invoice': change = { kind, on: S(f, 'on') === '1', biz: S(f, 'biz'), day: S(f, 'day') }; break;
    case 'collected': change = { kind, amount: num('amount'), day: S(f, 'day') }; break;
    case 'paid': change = { kind, amount: num('amount'), day: S(f, 'day') }; break;
    case 'hold': change = { kind, on: S(f, 'on') === '1' }; break;
    case 'billMonth': change = { kind, month: S(f, 'month') }; break;
    default: return { errors: [`모르는 걸음: ${kind}`] };
  }
  try {
    const r = await settlements.setLifecycle(S(f, 'code'), change);
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [e instanceof WriteDisabledError ? e.message : `저장하지 못했습니다 — ${(e as Error).message}`] };
  }
  revalidatePath('/settlement');
  revalidatePath('/intake');
  return { errors: [] };
}

/**
 * **수수료 미리보기** — 저장하지 않는다. 폼 칸: supplier · product · model · term · rent · price
 * ★저장할 때와 «같은 셈» (ERP5 수수료표). 화면은 이걸로 「표대로면 얼마」 를 보여 주고, 직접 입력 칸의 기본값으로 쓴다.
 */
export type FeePreview =
  | { status: 'AUTO'; claim: number; pay: number; ruleId: string; basis: string; version: string }
  | { status: 'MANUAL' | 'NO_RULE' | 'NO_BASE'; why: string; ruleId?: string; version: string }
  | { status: 'ERROR'; why: string };
export async function previewFeeAction(f: FormData): Promise<FeePreview> {
  try {
    const set = await loadFeeRuleSet();
    const num = (k: string) => { const n = N(f, k); return n === null || Number.isNaN(n) ? null : n; };
    const r = feeOf(set, { supplier: S(f, 'supplier'), product: S(f, 'product'), model: S(f, 'model'), term: num('term'), rent: num('rent'), price: num('price') });
    if (r.status === 'AUTO') return { status: 'AUTO', claim: r.claim, pay: r.pay, ruleId: r.rule.id, basis: r.rule.basis, version: set.version };
    return { status: r.status, why: r.why, ...('rule' in r ? { ruleId: r.rule.id } : {}), version: set.version };
  } catch (e) {
    return { status: 'ERROR', why: (e as Error).message };
  }
}

/** 접수 뒤 수수료 고치기. 폼 칸: code · feeClaim · feePay(비우면 그쪽 안 바꿈) · feeReason(필수) */
export async function feeAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const r = await settlements.setFee(S(f, 'code'), S(f, 'feeClaim') ? N(f, 'feeClaim') : null, S(f, 'feePay') ? N(f, 'feePay') : null, S(f, 'feeReason'));
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [e instanceof WriteDisabledError ? e.message : `저장하지 못했습니다 — ${(e as Error).message}`] };
  }
  revalidatePath('/intake');
  revalidatePath('/settlement');
  return { errors: [] };
}

/**
 * 환수 세우기 — 대표 「환수가 생기는경우가 있을수도 있으니까 그건 열어두고」.
 * 폼 칸: code · at(환수일 YYYY-MM-DD) · supplierAmt(공급사에 돌려줄 것) · agentAmt(영업채널에서 돌려받을 것) · reason(필수)
 * ★금액은 사람이 넣는다(조건이 공급사마다 다르다). 그 달 청구·지급에서 빠진다.
 */
export async function clawbackAction(_: FormState, f: FormData): Promise<FormState> {
  const n = (k: string) => { const v = N(f, k); return v === null ? null : v; };
  try {
    const r = await settlements.createClawback(S(f, 'code'), { at: S(f, 'at'), supplierAmt: n('supplierAmt'), agentAmt: n('agentAmt'), reason: S(f, 'reason') });
    if (!r.ok) return { errors: [r.error] };
  } catch (e) {
    return { errors: [e instanceof WriteDisabledError ? e.message : `저장하지 못했습니다 — ${(e as Error).message}`] };
  }
  revalidatePath('/settlement');
  revalidatePath('/intake');
  return { errors: [] };
}
