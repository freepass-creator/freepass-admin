/**
 * **청구 링크 — PDF 대신 링크를 보낸다. 사업자등록번호를 넣으면 보인다.**
 *
 * ★대표 2026-09-18 「공급사한테 청구서 PDF말고 이제 그냥 청구 링크를 보내자 사업자등록번호 넣으면 보이게끔」
 *
 * ── 무엇이 보이나 (erp4 settlement-confirm 규칙)
 *   ★각자 «자기 쪽 금액» 만 본다 — 공급사는 청구액만. 영업채널 지급액·우리 몫은 절대 안 싣는다(역산이 안 되게).
 *   ★발행 때 «굳힌» 사본을 보인다 — 번호가 붙은 종이는 안 바뀐다. 원장이 뒤에 바뀌면 다시 발행해야 새 사본이 선다.
 *   ★손님 이름은 가린다(홍○동) — 공급사는 차번으로 맞춘다.
 *   확인 단위 = 달 × 상대 (청구서가 나가는 단위).
 *
 * ── 문 (보안)
 *   열쇠   링크 안의 추측 못 할 토큰(32바이트). ★ERP5 에는 토큰의 해시만 둔다 — DB 가 새어도 링크를 못 만든다.
 *   확인   사업자등록번호 10자리가 그 상대의 등록 번호와 같아야 연다. ⚠ 사업자번호는 «비밀이 아니다» —
 *          진짜 문은 토큰이고, 사업자번호는 «링크가 엉뚱한 사람에게 넘어갔을 때» 한 번 더 거르는 것이다.
 *   잠금   10번 틀리면 30분 잠근다.
 *   거둠   관리자가 링크를 거두면(revoke) 그 토큰은 영영 안 열린다. 다시 만들면 새 토큰이다.
 *
 * ── 공급사가 할 수 있는 것
 *   확인    이 청구서가 맞다 → 그 줄들 청구 축 「확인」 (lifecycle confirm)
 *   이의    다르다(사유 · 어느 줄) → 그 줄들 「정정」 (lifecycle correct) — 우리가 보고 풀거나 다시 발행한다
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { invoiceMoneyOf, type Axis } from './lifecycle';
import type { Clawback, LedgerLine } from './ledgers';

/* ── 토큰 ── */
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (t: string) => createHash('sha256').update(`claim-link:${t}`).digest('hex');

/* ── 사업자등록번호 ── */
export const bizDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
/**
 * 국세청 검증번호 셈 — 오타로 틀린 번호를 «틀렸다» 고 바로 말한다(시도 횟수를 안 깎는다).
 * ⚠ 검증번호가 맞아도 «그 회사 번호» 인지는 모른다 — 그건 등록 번호와 견줘서 안다.
 */
export function bizChecksumOk(v: unknown): boolean {
  const d = bizDigits(v);
  if (d.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(d[i]) * w[i];
  sum += Math.floor((Number(d[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}
const sameDigits = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/* ── 손님 이름 가리기 ── */
export function maskName(n: unknown): string {
  const s = String(n ?? '').trim();
  if (!s) return '';
  if (/주식회사|㈜|\(주\)|법인|회사/.test(s)) return s;          // 법인 고객은 가릴 이름이 아니다
  const c = [...s];
  if (c.length === 1) return c[0];
  if (c.length === 2) return `${c[0]}○`;
  return `${c[0]}${'○'.repeat(c.length - 2)}${c[c.length - 1]}`;
}

/* ── 굳힌 사본 ── */
export interface InvoiceLineSnapshot {
  code: string; receivedAt: string; plate: string; model: string; customer: string;
  deliveredAt: string; product: string; term: number | null; rent: number | null;
  net: number; vat: number; total: number;
  /** 분납이 끊겨 받은 만큼만 실렸으면 그 몫 — 상대가 「왜 반만?」 을 안 묻게 */
  ratio?: number;
}
export interface ClawbackSnapshot { plate: string; at: string; reason: string; net: number; vat: number }

/** 발행 때 굳힐 사본 — ★그 축의 금액만 싣는다 */
export function snapshotOf(axis: Axis, party: string, month: string, lines: readonly LedgerLine[], claws: readonly Clawback[]):
  { lines: InvoiceLineSnapshot[]; clawbacks: ClawbackSnapshot[] } {
  return {
    lines: lines.map((l) => {
      const r = l.row;
      const m = invoiceMoneyOf(l.amount ?? 0, r.money.vatIncluded);
      return {
        code: r.id, receivedAt: r.receivedAt ?? '', plate: r.plate ?? '', model: r.model ?? '', customer: maskName(r.customer),
        deliveredAt: r.progress.deliveredAt ?? '', product: r.product ?? '', term: r.term, rent: r.rent,
        net: m.net, vat: m.vat, total: m.total, ...(l.broken ? { ratio: l.ratio } : {}),
      };
    }),
    clawbacks: claws
      .filter((c) => c.month === month && (axis === '공급사' ? c.supplier === party && c.supplierAmt : c.channel === party && c.agentAmt))
      .map((c) => { const amt = axis === '공급사' ? c.supplierAmt : c.agentAmt; return { plate: c.plate, at: c.at, reason: c.reason, net: amt, vat: Math.round(amt * 0.1) }; }),
  };
}

/* ── 문 열기 ── */
export interface LinkState {
  linkHash?: string; linkRevokedAt?: number | null; partyBizNo?: string;
  failCount?: number; lockedUntil?: number | null;
}
export const MAX_FAILS = 10;
export const LOCK_MS = 30 * 60_000;

export type OpenResult =
  | { ok: true }
  | { ok: false; reason: 'NO_LINK' | 'REVOKED' | 'LOCKED' | 'NO_BIZ' | 'BAD_FORMAT' | 'WRONG'; message: string; failCount?: number };

/** ★토큰은 이미 해시로 찾았다고 보고, 여기서는 거둠·잠금·사업자번호만 본다 */
export function checkOpen(s: LinkState, bizInput: string, now: number): OpenResult {
  if (!s.linkHash) return { ok: false, reason: 'NO_LINK', message: '링크가 없습니다' };
  if (s.linkRevokedAt) return { ok: false, reason: 'REVOKED', message: '거둬진 링크입니다 — 새 링크를 받으세요' };
  if (s.lockedUntil && s.lockedUntil > now) return { ok: false, reason: 'LOCKED', message: '여러 번 틀려 잠시 잠겼습니다 — 30분 뒤 다시 해 주세요' };
  const want = bizDigits(s.partyBizNo);
  if (want.length !== 10) return { ok: false, reason: 'NO_BIZ', message: '이 청구서에 사업자등록번호가 등록돼 있지 않습니다 — 프리패스에 문의해 주세요' };
  const got = bizDigits(bizInput);
  if (!bizChecksumOk(got)) return { ok: false, reason: 'BAD_FORMAT', message: '사업자등록번호 10자리를 확인해 주세요' };
  if (!sameDigits(got, want)) return { ok: false, reason: 'WRONG', message: '사업자등록번호가 맞지 않습니다', failCount: (s.failCount ?? 0) + 1 };
  return { ok: true };
}

/** 틀렸을 때 남길 것 — 10번째면 잠근다 */
export function failPatch(s: LinkState, now: number): Record<string, unknown> {
  const n = (s.failCount ?? 0) + 1;
  return n >= MAX_FAILS ? { failCount: 0, lockedUntil: now + LOCK_MS } : { failCount: n };
}
