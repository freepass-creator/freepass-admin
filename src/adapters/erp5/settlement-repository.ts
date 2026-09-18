import { erp5 } from './firestore';
import { toSettlementRow } from './to-settlement';
import type { SettlementRow } from '../../domain/settlement/types';
import { eventDocId, settlementKey } from '../../domain/settlement/code';
import { intakeRecord, progressPatch, type IntakeInput, type ProgressChange } from '../../domain/settlement/intake';

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
    const rec = intakeRecord(input, Date.now());
    const code = String(rec.code);
    const plate = String(rec.plate);
    const key = settlementKey(plate, input.receivedAt);

    return db.runTransaction(async (tx) => {
      const same = await tx.get(db.collection(ROWS).where('plate', '==', plate));
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
