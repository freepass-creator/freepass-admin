import { erp5 } from './firestore';
import { toSettlementRow } from './to-settlement';
import type { SettlementRow } from '../../domain/settlement/types';
import type { Clawback } from '../../domain/settlement/ledgers';
import { intakeEventDocId, intakeKey } from '../../domain/settlement/code';
import { feeManualErrors, intakeRecord, progressPatch, type IntakeInput, type ProgressChange } from '../../domain/settlement/intake';
import { feeFixPatch, moneyEditPatch } from '../../domain/settlement/adjust';
import { clawbackId, clawbackRecord, type ClawbackInput } from '../../domain/settlement/clawback';
import { bizChecksumOk, bizDigits, checkOpen, failPatch, newToken, planClaimResponse, snapshotOf, tokenHash, type ClaimResponse } from '../../domain/settlement/claim-link';
import { feeOf } from '../../domain/settlement/fee';
import { loadFeeRuleSet } from './fee-rules';
import { claimLedger, payLedger } from '../../domain/settlement/ledgers';
import { invoiceKey, invoiceNeedsCashAllocation, lifePatch, planInvoice, type Axis, type IssuedInvoice, type LifeChange } from '../../domain/settlement/lifecycle';
import { createHash } from 'node:crypto';
import type { DocumentReference } from 'firebase-admin/firestore';
import { numOrZero as N, strOf as S } from './atom';

/**
 * **정산 원장 문 뒤 — ERP5 `settlement_rows`.**
 *
 * ★★쓰기는 «열쇠를 돌려야» 열린다 — `ERP5_WRITE=on`.
 *   운영 원장이다. 개발 서버를 띄웠다고 원장에 줄이 서면 안 된다. 꺼져 있으면 이름을 대고 던진다.
 * ★쓸 때마다 `settlement_events` 에 이력을 남긴다 (erp4 가 쓰던 꼴 그대로 — 차번_접수일 문서 · aud_ 칸).
 * ★RTDB 는 쓰지 않는다 (2026-09-14 폐기).
 */
const ROWS = 'settlement_rows';
const EVENTS = 'settlement_events';
/** 발행 기록 — 한 달 · 한 축 · 한 상대 = 한 문서. 번호가 여기서 안 바뀐다 */
const INVOICES = 'settlement_invoices';
/** 실제 수금/지급 한 번 = 한 불변 거래. collectedAmt/paidAmt는 이 거래들의 빠른 projection이다. */
const CASH_EVENTS = 'settlement_cash_events';
const BY = 'freepass-admin';
const eventIdOf = (d: Record<string, unknown>) => intakeEventDocId(d.plate, d.sourceProductId, d.receivedAt);

export class WriteDisabledError extends Error {
  constructor() { super('ERP5 쓰기가 꺼져 있습니다 — .env.local 에 ERP5_WRITE=on 을 넣어야 저장됩니다.'); }
}
export const writeEnabled = () => process.env.ERP5_WRITE?.trim() === 'on';
const mustWrite = () => { if (!writeEnabled()) throw new WriteDisabledError(); };

const audId = () => {
  const A = '23456789abcdefghjkmnpqrstuvwxyz';
  let t = ''; for (let i = 0; i < 10; i += 1) t += A[Math.floor(Math.random() * A.length)];
  return `aud_${t}`;
};

export type RowWithRaw = { row: SettlementRow; raw: Record<string, unknown>; warnings: string[] };

const clawbackFromRaw = (c: Record<string, unknown>): Clawback => ({
  plate: S(c.plate), month: S(c.month), supplier: S(c.supplier), channel: S(c.channel),
  supplierAmt: N(c.supplierAmt), agentAmt: N(c.agentAmt), reason: S(c.reason), at: S(c.at),
  ...(S(c.code) ? { code: S(c.code) } : {}),
});

/** 상대에게 보이는 것 — ★굳힌 사본 · 그 축 금액만 · 링크 칸(해시·잠금)은 안 싣는다 */
export interface ClaimView {
  invoiceNo: string; month: string; axis: Axis; party: string; partyName: string;
  supply: number; vat: number; total: number; clawback: number; issuedAt: number;
  lines: unknown[]; clawbacks: unknown[];
  response: IssuedInvoice['response'] | null;
}
export function claimViewOf(inv: IssuedInvoice): ClaimView {
  return {
    invoiceNo: inv.invoiceNo, month: inv.month, axis: inv.axis, party: inv.party, partyName: inv.partyName ?? inv.party,
    supply: inv.supply, vat: inv.vat, total: inv.total, clawback: inv.clawback ?? 0, issuedAt: inv.issuedAt,
    lines: inv.snapshot?.lines ?? [], clawbacks: inv.snapshot?.clawbacks ?? [], response: inv.response ?? null,
  };
}

export class Erp5SettlementRepository {
  /**
   * **한 줄을 고치는 공통 골격.** ★쓰기 셋(진행 · 생애주기 · 수수료 고치기)이 토씨 하나 없이
   *   같은 모양이었다 — 줄을 읽고 · 도메인 순수함수에 넘기고 · 바뀐 칸만 쓰고 · 이력을 남긴다.
   *   여기 한 곳만 고치면 셋이 같이 고쳐진다(따로 두면 한 곳만 고치고 잊는 사고가 난다).
   * @param apply 원자(cur)와 도메인 줄(row)을 받아 {patch,events} 또는 실패 까닭을 낸다 — «무엇을 바꾸나»만 안다, 어떻게 쓰는지는 모른다.
   */
  private async mutateRow(
    code: string,
    apply: (cur: Record<string, unknown>, row: SettlementRow) => { ok: true; patch: Record<string, unknown>; events: { field: string; from: string; to: string }[] } | { ok: false; error: string },
    by: string = BY,
    operationId?: string,
    cash?: { axis: Axis; amount: number; day: string; kind: 'collected' | 'paid' },
  ): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
    mustWrite();
    const db = erp5();
    const ref = db.collection(ROWS).doc(code);
    return db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      if (!d.exists) return { ok: false as const, error: `없는 줄입니다: ${code}` };
      const cur = d.data()!;
      const { row } = toSettlementRow(cur, d.id);
      const eventRef = db.collection(EVENTS).doc(eventIdOf(cur));
      let cashRef: DocumentReference | null = null;
      let cashInvoiceRef: DocumentReference | null = null;
      if (cash && row.progress.billMonth) {
        const party = cash.axis === '공급사' ? row.supplier : row.channel;
        if (party) {
          cashInvoiceRef = db.collection(INVOICES).doc(
            `inv_${createHash('sha256').update(invoiceKey(row.progress.billMonth, cash.axis, party)).digest('hex').slice(0, 16)}`,
          );
        }
      }
      if (operationId) {
        const cashId = `cash_${createHash('sha256').update(`${code}|${operationId}`).digest('hex').slice(0, 24)}`;
        cashRef = db.collection(CASH_EVENTS).doc(cashId);
        const [eventDoc, cashDoc, cashInvoiceDoc] = await Promise.all([
          tx.get(eventRef),
          cash ? tx.get(cashRef) : Promise.resolve(null),
          cashInvoiceRef ? tx.get(cashInvoiceRef) : Promise.resolve(null),
        ]);
        const seenAudit = eventDoc.exists && Object.values(eventDoc.data() ?? {}).some((v) =>
          !!v && typeof v === 'object' && String((v as Record<string, unknown>).operationId ?? '') === operationId);
        if (seenAudit || (cashDoc && cashDoc.exists)) return { ok: true as const, changed: 0 };
        if (cashInvoiceDoc?.exists && invoiceNeedsCashAllocation(cashInvoiceDoc.data() as IssuedInvoice)) {
          return { ok: false as const, error: '환수가 포함된 묶음 문서는 행별 수금·지급 배분 정책이 아직 확정되지 않았습니다 — 이 문서는 수동 정산 확인이 필요합니다' };
        }
      }
      const r = apply(cur, row);
      if (!r.ok) return r;
      if (!r.events.length) return { ok: true as const, changed: 0 };
      const now = Date.now();
      tx.update(ref, { ...r.patch, updatedAt: now, stateAt: new Date(now).toISOString() });
      const ev: Record<string, unknown> = {};
      for (const e of r.events) ev[audId()] = { at: now, by, ...(operationId ? { operationId } : {}), ...e };
      tx.set(eventRef, ev, { merge: true });
      if (cash && operationId && cashRef) {
        tx.create(cashRef, {
          operationId, code, axis: cash.axis, kind: cash.kind,
          amount: Math.round(cash.amount), day: cash.day,
          by, createdAt: now,
        });
      }
      return { ok: true as const, changed: r.events.length };
    });
  }

  async list(): Promise<RowWithRaw[]> {
    const snap = await erp5().collection(ROWS).get();
    return snap.docs.map((d) => {
      const raw = d.data();
      const { row, warnings } = toSettlementRow(raw, d.id);
      return { row, raw, warnings };
    });
  }

  /** 환수 — ERP5 `settlement_clawbacks` (23건 실측). ★환수는 접수 줄의 체크가 아니라 «반대 부호의 한 줄» 이다 */
  async clawbacks(): Promise<Clawback[]> {
    const snap = await erp5().collection('settlement_clawbacks').get();
    return snap.docs.map((d) => clawbackFromRaw(d.data()));
  }

  /** 실제 수금/지급 거래 원장 — 누적 projection과 별도로 운영 점검/감사에서 읽는다. */
  async cashEvents(): Promise<Record<string, unknown>[]> {
    const snap = await erp5().collection(CASH_EVENTS).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async get(code: string): Promise<RowWithRaw | null> {
    const d = await erp5().collection(ROWS).doc(code).get();
    if (!d.exists) return null;
    const raw = d.data()!;
    const { row, warnings } = toSettlementRow(raw, d.id);
    return { row, raw, warnings };
  }

  /**
   * 접수 한 건을 세운다.
   * ★직접접수는 차번+접수일, 상품접수는 Product ID+접수일로 중복을 막는다.
   * ERP/F04에서 먼저 만든 기존 줄은 문서 id를 믿지 않고 같은 날짜의 실제 identity도 대조한다.
   */
  async createIntake(input: IntakeInput): Promise<{ code: string; created: boolean }> {
    mustWrite();
    const db = erp5();
    /* ★수수료는 ERP5 의 수수료표(settlement_fee_rules)로 센다 — 코드에 규칙 사본이 없다 */
    const rules = await loadFeeRuleSet();
    const fee = feeOf(rules, { supplier: input.supplier, product: input.product, model: input.model, term: input.term, rent: input.rent, price: input.price });
    const manualErr = feeManualErrors(input, fee);
    if (manualErr.length) throw new Error(manualErr.join(' · '));
    const rec = intakeRecord(input, Date.now(), fee, rules.version);
    const code = String(rec.code);
    const plate = String(rec.plate ?? '');
    const key = intakeKey(plate, input.sourceProductId, input.receivedAt);

    return db.runTransaction(async (tx) => {
      /*
       * ★같은 날 접수를 다 읽어 «열쇠» 로 견준다. 차번으로 찾으면 안 된다 —
       *   원장에 띄어쓰기가 든 차번이 있다(실측 6줄: 「12가 3456」). 그대로 찾으면 못 알아보고 두 줄이 선다.
       *   접수일은 461줄 모두 YYYY-MM-DD 한 꼴이다(실측).
       */
      const same = await tx.get(db.collection(ROWS).where('receivedAt', '==', input.receivedAt));
      const hit = same.docs.find((d) => {
        const x = d.data();
        if (intakeKey(x.plate, x.sourceProductId, x.receivedAt) === key) return true;
        const sameProduct = !!input.sourceProductId && String(x.sourceProductId ?? '') === input.sourceProductId;
        const norm = (v: unknown) => String(v ?? '').replace(/\s/g, '');
        const samePlate = !!plate && norm(x.plate) === norm(plate);
        return sameProduct || samePlate;
      });
      if (hit) return { code: hit.id, created: false };
      const byId = await tx.get(db.collection(ROWS).doc(code));
      if (byId.exists) return { code, created: false };
      tx.create(db.collection(ROWS).doc(code), rec);
      tx.set(db.collection(EVENTS).doc(intakeEventDocId(plate, input.sourceProductId, input.receivedAt)),
        { [audId()]: { at: rec.createdAt, by: BY, field: '접수', from: '', to: code } }, { merge: true });
      return { code, created: true };
    });
  }

  /** 계약서 · 인도 · 취소. ★바뀌는 칸만 쓰고 이력을 남긴다. 바뀔 게 없으면 안 쓴다. */
  async setProgress(code: string, change: ProgressChange): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
    return this.mutateRow(code, (cur) => progressPatch(cur, change));
  }

  /**
   * 프로모션 · 가감 — 수수료표 셈 위에 사람이 얹는 돈 (domain/settlement/adjust.ts).
   * ★청구서가 나간 줄의 청구 쪽, 지급이 끝난 줄의 지급 쪽은 못 바꾼다 — 나간 종이와 원장이 갈린다.
   *   그때는 다음 달 이월(carry)로 넘기는 것이 맞다(erp4 「가감사유 → 다음 달에 할 말」).
   */
  async setMoney(code: string, patch: Record<string, unknown>): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
    return this.mutateRow(code, (cur) => moneyEditPatch(cur, patch));
  }

  /**
   * **청구서(공급사) · 지급명세(영업채널) 발행** — 한 달 · 한 축 · 한 상대.
   * ★문서번호는 발행 때 붙고 안 바뀐다 — 같은 달·축·상대로 다시 발행하면 같은 번호를 다시 쓴다(settlement_invoices).
   * ★발행하면 그 줄들의 청구월을 그 달로 박는다 — 이제 그 달은 닫힌다.
   * ★계획과 쓰기 사이에 원장이 바뀌면(누가 고쳤으면) 쓰지 않고 「다시」 라고 말한다.
   */
  async issueInvoice(month: string, axis: Axis, party: string): Promise<{ ok: true; invoice: IssuedInvoice } | { ok: false; error: string }> {
    mustWrite();
    const db = erp5();
    const [all, claws] = await Promise.all([this.list(), this.clawbacks()]);
    const rows = all.map((x) => x.row);
    const groups = axis === '공급사' ? claimLedger(rows, month, claws) : payLedger(rows, month, claws);
    const g = groups.find((x) => x.party === party);
    if (!g) return { ok: false, error: `${month} · ${party} 에 실릴 줄이 없습니다` };
    const key = invoiceKey(month, axis, party);
    const invRef = db.collection(INVOICES).doc(`inv_${createHash('sha256').update(key).digest('hex').slice(0, 16)}`);
    const partyField = axis === '공급사' ? 'supplier' : 'channel';
    const initialIds = g.lines.map((l) => l.row.id);

    return db.runTransaction(async (tx) => {
      /*
       * 화면에서 읽은 뒤 발행할 때까지 줄/환수가 바뀔 수 있다.
       * 해당 거래처의 현재 줄 + 처음 본 줄(상대가 바뀐 경우까지) + 당월 환수를 트랜잭션 안에서 다시 읽어
       * 같은 도메인 함수로 재계산한 결과만 발행한다.
       */
      const [invDoc, sameMonth, partyRows, lockedMonthRows, clawRows, ...initialRows] = await Promise.all([
        tx.get(invRef),
        tx.get(db.collection(INVOICES).where('month', '==', month)),
        tx.get(db.collection(ROWS).where(partyField, '==', party)),
        tx.get(db.collection(ROWS).where('billMonth', '==', month)),
        tx.get(db.collection('settlement_clawbacks').where('month', '==', month)),
        ...initialIds.map((id) => tx.get(db.collection(ROWS).doc(id))),
      ]);

      const replacement = new Map<string, RowWithRaw>();
      for (const d of [...partyRows.docs, ...lockedMonthRows.docs, ...initialRows]) {
        if (!d.exists) continue;
        const raw = d.data()!;
        const { row, warnings } = toSettlementRow(raw, d.id);
        replacement.set(d.id, { row, raw, warnings });
      }
      const replaceIds = new Set([...initialIds, ...partyRows.docs.map((d) => d.id), ...lockedMonthRows.docs.map((d) => d.id)]);
      const mergedRows = [
        ...rows.filter((r) => !replaceIds.has(r.id)),
        ...[...replacement.values()].map((x) => x.row),
      ];
      const freshClaws = clawRows.docs.map((d) => clawbackFromRaw(d.data()));
      const freshGroups = axis === '공급사' ? claimLedger(mergedRows, month, freshClaws) : payLedger(mergedRows, month, freshClaws);
      const freshG = freshGroups.find((x) => x.party === party);
      if (!freshG) return { ok: false as const, error: '그 사이 발행 대상이 바뀌었습니다 — 다시 불러와 확인합니다' };

      const existing = invDoc.exists ? (invDoc.data() as IssuedInvoice) : null;
      const party0 = await this.partyOf(axis, freshG.lines.map((l) => (axis === '공급사' ? l.row.supplierCode : l.row.channelCode)));
      const taken = sameMonth.docs.map((d) => String(d.data().invoiceNo ?? ''));
      const now = Date.now();
      const plan = planInvoice(month, axis, party, freshG.lines, freshClaws, existing, taken, now, BY);
      if (!plan.ok) return plan;
      for (const x of plan.patches) {
        if (!Object.keys(x.patch).length) continue;
        const cur = replacement.get(x.code)?.raw;
        if (!cur) return { ok: false as const, error: '그 사이 원장 줄을 다시 읽지 못했습니다 — 다시 불러와 발행합니다' };
        tx.update(db.collection(ROWS).doc(x.code), { ...x.patch, updatedAt: now, stateAt: new Date(now).toISOString(), [`invoiceNo${axis === '공급사' ? 'S' : 'P'}`]: plan.invoice.invoiceNo });
        const ev: Record<string, unknown> = {};
        for (const e of x.events) ev[audId()] = { at: now, by: BY, ...e };
        if (x.events.length) tx.set(db.collection(EVENTS).doc(eventIdOf(cur)), ev, { merge: true });
      }
      /* ★상대에게 보일 사본 — 발행한 줄(보류 뺀)만 · 그 축 금액만 */
      const live = new Set(plan.invoice.codes);
      const snapshot = snapshotOf(axis, party, month, freshG.lines.filter((l) => live.has(l.row.id)), freshClaws);
      /* ★다시 발행이면 번호는 그대로 · 합계·줄은 새로 (옛 합계는 history 로 남긴다) · 링크는 그대로 둔다(같은 링크로 새 사본이 보인다) */
      tx.set(invRef, {
        ...(existing ?? {}),
        ...plan.invoice,
        ...party0,
        snapshot,
        ...(existing ? { response: null } : {}),
        ...(existing ? { history: [...((existing as unknown as { history?: unknown[] }).history ?? []), { supply: existing.supply, vat: existing.vat, lines: existing.lines, issuedAt: existing.issuedAt }] } : {}),
      });
      return { ok: true as const, invoice: plan.invoice };
    });
  }

  /**
   * 상대 거래처 — ★코드로만 찾는다(가장 많이 쓰인 코드). 이름으로 맞추면 빈 이름이 우리 회사에 붙는다(실측).
   */
  private async partyOf(axis: Axis, codes: (string | null)[]): Promise<{ partyCode?: string; partyName?: string; partyBizNo?: string }> {
    const count = new Map<string, number>();
    for (const c of codes) if (c) count.set(c, (count.get(c) ?? 0) + 1);
    const code = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!code) return {};
    const snap = await erp5().collection('partner').where('partner_code', '==', code).limit(5).get();
    const p = snap.docs.map((d) => d.data()).find((x) => !x._deleted && !x.merged_into);
    if (!p) return { partyCode: code };
    return { partyCode: code, partyName: String(p.partner_name ?? ''), partyBizNo: bizDigits(p.business_number) };
  }

  private invoiceRef(month: string, axis: Axis, party: string) {
    return erp5().collection(INVOICES).doc(`inv_${createHash('sha256').update(invoiceKey(month, axis, party)).digest('hex').slice(0, 16)}`);
  }

  /**
   * **청구 링크 만들기** — 토큰은 이때 «한 번만» 돌려준다(ERP5 에는 해시만).
   * ★발행한 뒤에만 · 사업자등록번호가 등록돼 있어야 · 새로 만들면 옛 링크는 못 쓴다.
   */
  async createClaimLink(month: string, axis: Axis, party: string): Promise<{ ok: true; token: string; warn?: string } | { ok: false; error: string }> {
    mustWrite();
    const ref = this.invoiceRef(month, axis, party);
    const d = await ref.get();
    if (!d.exists) return { ok: false, error: '아직 발행 전입니다 — 발행한 뒤에 링크를 만듭니다' };
    const inv = d.data() as IssuedInvoice;
    const biz = bizDigits(inv.partyBizNo);
    if (biz.length !== 10) return { ok: false, error: `「${party}」 의 사업자등록번호가 거래처(partner ${inv.partyCode ?? '코드 없음'})에 없습니다 — 먼저 채워야 합니다` };
    const token = newToken();
    await ref.update({ linkHash: tokenHash(token), linkCreatedAt: Date.now(), linkRevokedAt: null, failCount: 0, lockedUntil: null });
    return { ok: true, token, ...(bizChecksumOk(biz) ? {} : { warn: `등록된 사업자등록번호(${biz.slice(0, 3)}-…)가 검증번호에 안 맞습니다 — 상대가 바른 번호를 넣으면 안 열립니다. 거래처 번호를 확인하세요` }) };
  }

  async revokeClaimLink(month: string, axis: Axis, party: string): Promise<{ ok: true } | { ok: false; error: string }> {
    mustWrite();
    const ref = this.invoiceRef(month, axis, party);
    if (!(await ref.get()).exists) return { ok: false, error: '없는 청구서입니다' };
    await ref.update({ linkRevokedAt: Date.now() });
    return { ok: true };
  }

  /** 토큰으로 청구서 찾기 — 해시로만 찾는다 */
  private async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
    const snap = await erp5().collection(INVOICES).where('linkHash', '==', tokenHash(token)).limit(1).get();
    return snap.empty ? null : snap.docs[0].ref;
  }

  /**
   * **상대가 연다** — 사업자등록번호가 맞으면 굳힌 사본을 돌려준다. 틀리면 셈하고 10번이면 잠근다.
   * ★돌려주는 것에 우리 몫·반대 축 금액·원장 코드 밖의 것은 없다.
   */
  async openClaim(token: string, bizNo: string): Promise<{ ok: true; view: ClaimView } | { ok: false; error: string }> {
    const ref = await this.byToken(token);
    if (!ref) return { ok: false, error: '링크를 찾을 수 없습니다' };
    const db = erp5();
    return db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      const inv = d.data() as IssuedInvoice;
      const now = Date.now();
      const r = checkOpen(inv, bizNo, now);
      if (!r.ok) {
        if (r.reason === 'WRONG') tx.update(ref, failPatch(inv, now));
        return { ok: false as const, error: r.message };
      }
      tx.update(ref, { failCount: 0, openedAt: now, openCount: (inv.openCount ?? 0) + 1 });
      return { ok: true as const, view: claimViewOf(inv) };
    });
  }

  /**
   * **상대가 답한다** — 확인 또는 이의. 매번 사업자등록번호를 다시 본다(링크는 문서 하나, 세션이 없다).
   * 확인 → 그 줄들 그 축 「확인」 · 이의 → 고른 줄(없으면 전부) 「정정」 + 사유
   */
  async respondClaim(token: string, bizNo: string, kind: '확인' | '이의', memo: string, codes: string[]): Promise<{ ok: true; response: ClaimResponse } | { ok: false; error: string }> {
    mustWrite();
    const ref = await this.byToken(token);
    if (!ref) return { ok: false, error: '링크를 찾을 수 없습니다' };
    const db = erp5();
    return db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      const inv = d.data() as IssuedInvoice;
      const now = Date.now();
      const r = checkOpen(inv, bizNo, now);
      if (!r.ok) { if (r.reason === 'WRONG') tx.update(ref, failPatch(inv, now)); return { ok: false as const, error: r.message }; }
      const responsePlan = planClaimResponse(inv.response ?? null, kind, memo, codes, inv.codes, now);
      if (!responsePlan.ok) return responsePlan;
      if (responsePlan.idempotent) return { ok: true as const, response: responsePlan.response };
      const target = responsePlan.target;
      const rowDocs = await Promise.all(target.map((c) => tx.get(db.collection(ROWS).doc(c))));
      if (rowDocs.some((rd) => !rd.exists)) return { ok: false as const, error: '발행 뒤 원장 줄이 사라졌습니다 — 관리자 확인이 필요합니다' };
      const who = `${inv.axis}-link:${inv.partyCode ?? inv.party}`;
      const planned: {
        rd: (typeof rowDocs)[number];
        cur: Record<string, unknown>;
        patch: Record<string, unknown>;
        events: { field: string; from: string; to: string }[];
      }[] = [];
      /* ★모든 행을 먼저 검증한다. 하나라도 실패하면 아직 tx.write를 한 번도 호출하지 않은 상태로 끝낸다. */
      for (const rd of rowDocs) {
        const cur = rd.data()!;
        const { row } = toSettlementRow(cur, rd.id);
        const p = lifePatch(row, kind === '확인' ? { kind: 'confirm', axis: inv.axis } : { kind: 'correct', axis: inv.axis, amount: null, memo: memo.trim() });
        if (!p.ok) return { ok: false as const, error: p.error };
        planned.push({ rd, cur, patch: p.patch, events: p.events });
      }
      for (const x of planned) {
        if (!x.events.length) continue;
        tx.update(x.rd.ref, { ...x.patch, updatedAt: now, stateAt: new Date(now).toISOString() });
        const ev: Record<string, unknown> = {};
        for (const e of x.events) ev[audId()] = { at: now, by: who, ...e };
        tx.set(db.collection(EVENTS).doc(eventIdOf(x.cur)), ev, { merge: true });
      }
      tx.update(ref, { response: responsePlan.response, failCount: 0 });
      return { ok: true as const, response: responsePlan.response };
    });
  }

  /** 그 달의 발행 기록 — 화면이 「이미 나갔나 · 번호 · 달라졌나(driftOf)」 를 말할 때 */
  async invoices(month: string): Promise<IssuedInvoice[]> {
    const snap = await erp5().collection(INVOICES).where('month', '==', month).get();
    return snap.docs.map((d) => d.data() as IssuedInvoice).sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo));
  }

  /** 한 줄의 다음 걸음 — 확인 · 정정 · 계산서 · 수금 · 지급 · 보류 · 청구월 (domain/settlement/lifecycle.ts) */
  async setLifecycle(code: string, change: LifeChange, operationId?: string): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
    const cash = change.kind === 'collected'
      ? { axis: '공급사' as const, amount: change.amount, day: change.day, kind: change.kind }
      : change.kind === 'paid'
        ? { axis: '영업채널' as const, amount: change.amount, day: change.day, kind: change.kind }
        : undefined;
    return this.mutateRow(code, (_cur, row) => lifePatch(row, change), BY, operationId, cash);
  }

  /**
   * 환수 세우기 (domain/settlement/clawback.ts) — settlement_clawbacks 에 한 줄 · 원장 줄에는 이력만.
   * ★같은 차·같은 달 환수가 이미 있으면 새로 안 세운다.
   */
  async createClawback(code: string, input: ClawbackInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    mustWrite();
    const db = erp5();
    const ref = db.collection(ROWS).doc(code);
    return db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      if (!d.exists) return { ok: false as const, error: `없는 줄입니다: ${code}` };
      const cur = d.data()!;
      const { row } = toSettlementRow(cur, d.id);
      const now = Date.now();
      const r = clawbackRecord(row, input, BY, now);
      if (!r.ok) return r;
      const cref = db.collection('settlement_clawbacks').doc(r.id);
      const legacyRef = db.collection('settlement_clawbacks').doc(clawbackId(row.plate, String(r.doc.month)));
      const [currentDoc, legacyDoc] = await Promise.all([tx.get(cref), tx.get(legacyRef)]);
      if (currentDoc.exists) return { ok: false as const, error: `이 계약의 ${String(r.doc.month)} 환수가 이미 있습니다 — 새로 세우지 않습니다` };
      if (legacyDoc.exists) {
        return { ok: false as const, error: `레거시 환수(${legacyRef.id})가 이미 있어 계약을 안전하게 구분할 수 없습니다 — 기존 환수를 확인한 뒤 처리합니다` };
      }
      tx.create(cref, r.doc);
      tx.set(db.collection(EVENTS).doc(eventIdOf(cur)),
        { [audId()]: { at: now, by: BY, field: '환수', from: '', to: `${r.doc.at} 공급 ${r.doc.supplierAmt} · 영업 ${r.doc.agentAmt} · ${r.doc.reason}` } }, { merge: true });
      return { ok: true as const, id: r.id };
    });
  }

  /** 접수 뒤 수수료 고치기 (domain/settlement/adjust.ts feeFixPatch) */
  async setFee(code: string, claim: number | null, pay: number | null, reason: string): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
    return this.mutateRow(code, (cur) => feeFixPatch(cur, claim, pay, reason));
  }

  /** 한 줄의 이력 — 최신이 앞. */
  async events(plate: unknown, receivedAt: unknown, sourceProductId?: unknown): Promise<{ at: number; by: string; field: string; from: string; to: string }[]> {
    const d = await erp5().collection(EVENTS).doc(intakeEventDocId(plate, sourceProductId, receivedAt)).get();
    if (!d.exists) return [];
    return Object.values(d.data()!)
      .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
      .map((v) => ({ at: Number(v.at) || 0, by: String(v.by ?? ''), field: String(v.field ?? ''), from: String(v.from ?? ''), to: String(v.to ?? '') }))
      .sort((a, b) => b.at - a.at);
  }
}
