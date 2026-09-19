'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { esign } from '../../server/esign';
import { settlements } from '../../server/erp5';
import { currentAdmin, requireAdmin } from '../../server/require-admin';

export type EsignActionState = { error?: string; ok?: string; url?: string };

const S = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const N = (f: FormData, k: string) => Number(S(f, k).replace(/[,s원]/g, ''));

async function actor() {
  const gate = await requireAdmin();
  if (gate) throw new Error(gate);
  return (await currentAdmin())?.name ?? 'admin';
}

export async function issueEsignAction(_: EsignActionState, f: FormData): Promise<EsignActionState> {
  try {
    const r = await esign.issue(S(f, 'contractId'), await actor());
    revalidatePath('/esign');
    return { ok: '고객 링크를 발행했습니다.', url: r.publicUrl };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function revokeEsignAction(_: EsignActionState, f: FormData): Promise<EsignActionState> {
  try {
    await esign.revoke(S(f, 'contractId'), await actor());
    revalidatePath('/esign');
    return { ok: '고객 링크를 해지했습니다.' };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function rejectEsignAction(_: EsignActionState, f: FormData): Promise<EsignActionState> {
  try {
    const items = S(f, 'items').split(',').map((x) => x.trim()).filter(Boolean);
    await esign.reject(S(f, 'contractId'), S(f, 'reason'), items, await actor());
    revalidatePath('/esign');
    return { ok: '같은 링크로 보완을 요청했습니다.' };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function approveEsignAction(_: EsignActionState, f: FormData): Promise<EsignActionState> {
  try {
    const r = await esign.approve(S(f, 'contractId'), await actor());
    if (r.settlementRowId) {
      await settlements.setProgress(r.settlementRowId, { kind: 'paper', on: true });
      revalidatePath('/intake');
      revalidatePath('/performance');
    }
    revalidatePath('/esign');
    return { ok: '승인·봉인했습니다.', url: r.documentUrl };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function createEsignContractAction(_: EsignActionState, f: FormData): Promise<EsignActionState> {
  try {
    const r = await esign.createContract({
      customerName: S(f, 'customerName'),
      customerPhone: S(f, 'customerPhone'),
      customerType: (S(f, 'customerType') || '개인') as '개인' | '개인사업자' | '법인',
      vehicleName: S(f, 'vehicleName'),
      plate: S(f, 'plate'),
      supplierCode: S(f, 'supplierCode'),
      supplierName: S(f, 'supplierName'),
      rent: N(f, 'rent'),
      termMonths: N(f, 'termMonths'),
      deposit: N(f, 'deposit'),
      contractDate: S(f, 'contractDate'),
      contractKind: S(f, 'contractKind'),
      insuranceSide: (S(f, 'insuranceSide') || '회사포함') as '회사포함' | '고객직접',
      settlementRowId: S(f, 'settlementRowId') || undefined,
    }, await actor());
    revalidatePath('/esign');
    const returnTo = S(f, 'returnTo');
    if (returnTo.startsWith('/intake?')) redirect(returnTo);
    redirect('/esign?saved=' + encodeURIComponent(r.id) + '&v=list');
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e;
    return { error: (e as Error).message };
  }
}
