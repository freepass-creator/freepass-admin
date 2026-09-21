'use server';

import { settlements } from '../../server/erp5';
import type { ClaimView } from '../../adapters/erp5/settlement-repository';
import type { ClaimResponse } from '../../domain/settlement/claim-link';

/**
 * **청구 링크 — 공급사(상대)가 쓰는 문.** 로그인이 없다. 토큰 + 사업자등록번호가 전부다.
 * ★대표 2026-09-18 「공급사한테 청구서 PDF말고 이제 그냥 청구 링크를 보내자 사업자등록번호 넣으면 보이게끔」
 * ★부를 때마다 토큰과 사업자등록번호를 «다시» 본다 — 세션을 두지 않는다(열어 둔 탭을 남이 이어 쓰지 못하게).
 * ★여기서 돌려주는 것은 claimViewOf 뿐 — 우리 몫·반대 축 금액은 없다.
 */
export type OpenState = { ok: true; view: ClaimView } | { ok: false; error: string } | null;

export async function openClaimAction(_: OpenState, f: FormData): Promise<OpenState> {
  try { return await settlements.openClaim(String(f.get('token') ?? ''), String(f.get('bizNo') ?? '')); }
  catch { return { ok: false, error: '지금 열 수 없습니다 — 잠시 뒤 다시 해 주세요' }; }
}

/** 폼 칸: token · bizNo · kind(확인|이의) · memo(이의면 필수) · codes(이의할 줄 · 여러 개 · 없으면 전부) */
export type ClaimResponseState = { ok: true; response: ClaimResponse } | { ok: false; error: string } | null;

export async function respondClaimAction(_: ClaimResponseState, f: FormData): Promise<ClaimResponseState> {
  const kind = String(f.get('kind') ?? '');
  if (kind !== '확인' && kind !== '이의') return { ok: false, error: '확인 또는 이의' };
  try {
    const r = await settlements.respondClaim(String(f.get('token') ?? ''), String(f.get('bizNo') ?? ''), kind, String(f.get('memo') ?? ''), f.getAll('codes').map(String));
    return r.ok ? { ok: true, response: r.response } : { ok: false, error: r.error };
  } catch { return { ok: false, error: '지금 저장할 수 없습니다 — 잠시 뒤 다시 해 주세요' }; }
}
