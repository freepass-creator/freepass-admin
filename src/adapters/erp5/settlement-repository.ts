import { erp5 } from './firestore';
import { toSettlementRow } from './to-settlement';
import type { SettlementRow } from '../../domain/settlement/types';
import type { Clawback } from '../../domain/settlement/ledgers';
import { eventDocId, settlementKey } from '../../domain/settlement/code';
import { intakeRecord, progressPatch, type IntakeInput, type ProgressChange } from '../../domain/settlement/intake';
import { feeOf } from '../../domain/settlement/fee';
import { loadFeeRuleSet } from './fee-rules';
import { claimLedger, payLedger } from '../../domain/settlement/ledgers';
import { invoiceKey, lifePatch, planInvoice, type Axis, type IssuedInvoice, type LifeChange } from '../../domain/settlement/lifecycle';
import { createHash } from 'node:crypto';

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
const BY = 'freepass-admin';

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

export class Erp5SettlementRepository {
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
    const S = (v: unknown) => String(v ?? '').trim();
    const N = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s원]/g, '')); return Number.isFinite(n) ? n : 0; };
    return snap.docs.map((d) => {
      const c = d.data();
      return {
        plate: S(c.plate), month: S(c.month), supplier: S(c.supplier), channel: S(c.channel),
        supplierAmt: N(c.supplierAmt), agentAmt: N(c.agentAmt), reason: S(c.reason), at: S(c.at),
      };
    });
  }

  async get(code: string): Promise<RowWithRaw | null> {
    const d = await erp5().collection(ROWS).doc(code).get();
    if (!d.exists) return null;
    const raw = d.data()!;
    const { row, warnings } = toSettlementRow(raw, d.id);
    return { row, raw, warnings };
  }

  /**
   * 접수 한 건을 세운다. ★같은 차번+접수일이 이미 있으면 «안 만든다» — 있던 코드를 돌려준다.
   *   ERP 화면에서 먼저 넣은 줄은 코드가 무작위라 문서 id 로는 못 찾는다 ⇒ 열쇠로도 찾는다.
   */
  async createIntake(input: IntakeInput): Promise<{ code: string; created: boolean }> {
    mustWrite();
    const db = erp5();
    /* ★수수료는 ERP5 의 수수료표(settlement_fee_rules)로 센다 — 코드에 규칙 사본이 없다 */
    const rules = await loadFeeRuleSet();
    const fee = feeOf(rules, { supplier: input.supplier, product: input.product, model: input.model, term: input.term, rent: input.rent, price: input.price });
    const rec = intakeRecord(input, Date.now(), fee, rules.version);
    const code = String(rec.code);
    const plate = String(rec.plate);
    const key = settlementKey(plate, input.receivedAt);

    return db.runTransaction(async (tx) => {
      /*
       * ★같은 날 접수를 다 읽어 «열쇠» 로 견준다. 차번으로 찾으면 안 된다 —
       *   원장에 띄어쓰기가 든 차번이 있다(실측 6줄: 「12가 3456」). 그대로 찾으면 못 알아보고 두 줄이 선다.
       *   접수일은 461줄 모두 YYYY-MM-DD 한 꼴이다(실측).
       */
      const same = await tx.get(db.collection(ROWS).where('receivedAt', '==', input.receivedAt));
      const hit = same.docs.find((d) => settlementKey(d.data().plate, d.data().receivedAt) === key);
      if (hit) return { code: hit.id, created: false };
      const byId = await tx.get(db.collection(ROWS).doc(code));
      if (byId.exists) return { code, created: false };
      tx.create(db.collection(ROWS).doc(code), rec);
      tx.set(db.collection(EVENTS).doc(eventDocId(plate, input.receivedAt)),
        { [audId()]: { at: rec.createdAt, by: BY, field: '접수', from: '', to: code } }, { merge: true });
      return { code, created: true };
    });
  }

  /** 계약서 · 인도 · 취소. ★바뀌는 칸만 쓰고 이력을 남긴다. 바뀔 게 없으면 안 쓴다. */
  async setProgress(code: string, change: ProgressChange): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
    mustWrite();
    const db = erp5();
    const ref = db.collection(ROWS).doc(code);
    return db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      if (!d.exists) return { ok: false as const, error: `없는 줄입니다: ${code}` };
      const cur = d.data()!;
      const r = progressPatch(cur, change);
      if (!r.ok) return r;
      if (!r.events.length) return { ok: true as const, changed: 0 };
      const now = Date.now();
      tx.update(ref, { ...r.patch, updatedAt: now, stateAt: new Date(now).toISOString() });
      const ev: Record<string, unknown> = {};
      for (const e of r.events) ev[audId()] = { at: now, by: BY, ...e };
      tx.set(db.collection(EVENTS).doc(eventDocId(cur.plate, cur.receivedAt)), ev, { merge: true });
      return { ok: true as const, changed: r.events.length };
    });
  }

  /**
   * 프로모션 · 가감 — 수수료표 셈 위에 사람이 얹는 돈 (domain/settlement/adjust.ts).
   * ★청구서가 나간 줄의 청구 쪽, 지급이 끝난 줄의 지급 쪽은 못 바꾼다 — 나간 종이와 원장이 갈린다.
   *   그때는 다음 달 이월(carry)로 넘기는 것이 맞다(erp4 「가감사유 → 다음 달에 할 말」).
   */
  async setMoney(code: string, patch: Record<string, unknown>): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
    mustWrite();
    const db = erp5();
    const ref = db.collection(ROWS).doc(code);
    const LABEL: Record<string, string> = {
      claimIncentive: '프로모션(공급사)', payIncentive: '프로모션(영업자)', promoShare: '프로모션 영업자 비율', promoReason: '프로모션 사유',
      claimAdjust: '가감(청구)', payAdjust: '가감(지급)', adjustReason: '가감 사유',
    };
    const CLAIM_SIDE = new Set(['claimIncentive', 'claimAdjust']);
    const PAY_SIDE = new Set(['payIncentive', 'payAdjust']);
    return db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      if (!d.exists) return { ok: false as const, error: `없는 줄입니다: ${code}` };
      const cur = d.data()!;
      if (cur.cancelled === true) return { ok: false as const, error: '취소된 줄입니다' };
      const changed = Object.entries(patch).filter(([k, v]) => k in LABEL && String(cur[k] ?? '') !== String(v ?? ''));
      if (!changed.length) return { ok: true as const, changed: 0 };
      if (cur.billed === true && changed.some(([k]) => CLAIM_SIDE.has(k))) return { ok: false as const, error: '청구서가 나간 줄입니다 — 청구 쪽은 다음 달 이월로 넘깁니다' };
      if (cur.paid === true && changed.some(([k]) => PAY_SIDE.has(k))) return { ok: false as const, error: '지급이 끝난 줄입니다 — 지급 쪽은 다음 달 이월로 넘깁니다' };
      const now = Date.now();
      tx.update(ref, { ...Object.fromEntries(changed), updatedAt: now, stateAt: new Date(now).toISOString() });
      const ev: Record<string, unknown> = {};
      for (const [k, v] of changed) ev[audId()] = { at: now, by: BY, field: LABEL[k], from: String(cur[k] ?? ''), to: String(v ?? '') };
      tx.set(db.collection(EVENTS).doc(eventDocId(cur.plate, cur.receivedAt)), ev, { merge: true });
      return { ok: true as const, changed: changed.length };
    });
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
    const stamp = new Map(all.map((x) => [x.row.id, String(x.raw.updatedAt ?? '')]));
    const key = invoiceKey(month, axis, party);
    const invRef = db.collection(INVOICES).doc(`inv_${createHash('sha256').update(key).digest('hex').slice(0, 16)}`);

    return db.runTransaction(async (tx) => {
      const [invDoc, sameMonth, ...fresh] = await Promise.all([
        tx.get(invRef),
        tx.get(db.collection(INVOICES).where('month', '==', month)),
        ...g.lines.map((l) => tx.get(db.collection(ROWS).doc(l.row.id))),
      ]);
      for (const d of fresh) {
        if (!d.exists || String(d.data()!.updatedAt ?? '') !== stamp.get(d.id)) {
          return { ok: false as const, error: '그 사이 원장이 바뀌었습니다 — 다시 불러와 발행합니다' };
        }
      }
      const existing = invDoc.exists ? (invDoc.data() as IssuedInvoice) : null;
      const taken = sameMonth.docs.map((d) => String(d.data().invoiceNo ?? ''));
      const now = Date.now();
      const plan = planInvoice(month, axis, party, g.lines, claws, existing, taken, now, BY);
      if (!plan.ok) return plan;
      for (const x of plan.patches) {
        if (!Object.keys(x.patch).length) continue;
        const cur = fresh.find((d) => d.id === x.code)!.data()!;
        tx.update(db.collection(ROWS).doc(x.code), { ...x.patch, updatedAt: now, stateAt: new Date(now).toISOString(), [`invoiceNo${axis === '공급사' ? 'S' : 'P'}`]: plan.invoice.invoiceNo });
        const ev: Record<string, unknown> = {};
        for (const e of x.events) ev[audId()] = { at: now, by: BY, ...e };
        if (x.events.length) tx.set(db.collection(EVENTS).doc(eventDocId(cur.plate, cur.receivedAt)), ev, { merge: true });
      }
      /* ★다시 발행이면 번호는 그대로 · 합계·줄은 새로 (옛 합계는 history 로 남긴다) */
      tx.set(invRef, {
        ...plan.invoice,
        ...(existing ? { history: [...((existing as unknown as { history?: unknown[] }).history ?? []), { supply: existing.supply, vat: existing.vat, lines: existing.lines, issuedAt: existing.issuedAt }] } : {}),
      });
      return { ok: true as const, invoice: plan.invoice };
    });
  }

  /** 그 달의 발행 기록 — 화면이 「이미 나갔나 · 번호 · 달라졌나(driftOf)」 를 말할 때 */
  async invoices(month: string): Promise<IssuedInvoice[]> {
    const snap = await erp5().collection(INVOICES).where('month', '==', month).get();
    return snap.docs.map((d) => d.data() as IssuedInvoice).sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo));
  }

  /** 한 줄의 다음 걸음 — 확인 · 정정 · 계산서 · 수금 · 지급 · 보류 · 청구월 (domain/settlement/lifecycle.ts) */
  async setLifecycle(code: string, change: LifeChange): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
    mustWrite();
    const db = erp5();
    const ref = db.collection(ROWS).doc(code);
    return db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      if (!d.exists) return { ok: false as const, error: `없는 줄입니다: ${code}` };
      const cur = d.data()!;
      const { row } = toSettlementRow(cur, d.id);
      const r = lifePatch(row, change);
      if (!r.ok) return r;
      if (!r.events.length) return { ok: true as const, changed: 0 };
      const now = Date.now();
      tx.update(ref, { ...r.patch, updatedAt: now, stateAt: new Date(now).toISOString() });
      const ev: Record<string, unknown> = {};
      for (const e of r.events) ev[audId()] = { at: now, by: BY, ...e };
      tx.set(db.collection(EVENTS).doc(eventDocId(cur.plate, cur.receivedAt)), ev, { merge: true });
      return { ok: true as const, changed: r.events.length };
    });
  }

  /** 한 줄의 이력 — 최신이 앞. */
  async events(plate: unknown, receivedAt: unknown): Promise<{ at: number; by: string; field: string; from: string; to: string }[]> {
    const d = await erp5().collection(EVENTS).doc(eventDocId(plate, receivedAt)).get();
    if (!d.exists) return [];
    return Object.values(d.data()!)
      .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
      .map((v) => ({ at: Number(v.at) || 0, by: String(v.by ?? ''), field: String(v.field ?? ''), from: String(v.from ?? ''), to: String(v.to ?? '') }))
      .sort((a, b) => b.at - a.at);
  }
}
