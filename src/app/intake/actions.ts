'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { settlements, today } from '../../server/erp5';
import { WriteDisabledError } from '../../adapters/erp5/settlement-repository';
import { validateIntake, type IntakeInput, type ProgressChange } from '../../domain/settlement/intake';

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
  };
  const errors = validateIntake(input, today());
  if (errors.length) return { errors };

  let res: { code: string; created: boolean };
  try { res = await settlements.createIntake(input); }
  catch (e) {
    return { errors: [e instanceof WriteDisabledError ? e.message : `저장하지 못했습니다 — ${(e as Error).message}`] };
  }
  revalidatePath('/intake');
  /* ★이미 있던 줄이면 새로 안 만들고 그 줄로 보낸다 (대표 「있으면 안 올리면 되잖아」) */
  redirect(`/intake/${res.code}?${res.created ? 'created=1' : 'exists=1'}`);
}

export async function progressAction(_: FormState, f: FormData): Promise<FormState> {
  const code = S(f, 'code');
  const kind = S(f, 'kind');
  const on = S(f, 'on') === '1';
  let change: ProgressChange;
  if (kind === 'paper') change = { kind, on };
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
