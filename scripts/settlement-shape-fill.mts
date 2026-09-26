/**
 * **정산 줄의 «빠진 칸» 을 기본값으로 채운다** — 있는 값은 한 글자도 안 바꾼다.
 *
 *   npx tsx scripts/settlement-shape-fill.mts            ← 헛돌기
 *   npx tsx scripts/settlement-shape-fill.mts --apply    ← 쓴다
 *
 * ★왜 — 2026-09-18 F04 연동(f04-fill-erp5)이 새 줄을 «시트에 있는 칸만» 으로 세웠다.
 *   10줄에 claimStage·payStage·settleTarget·settleRatio 등 50여 칸이 없었다(디자인 세션이 찾았다:
 *   stl_u47n7ftygk 의 청구 축이 원자에는 비고 도메인은 「접수」 로 채워 두 값이 갈렸다).
 *   ⇒ 원자 자체를 기존 461줄과 같은 꼴(intakeRecord 의 70여 칸)로 맞춘다. 화면에서 메우지 않는다.
 *
 * ★기본값은 intakeRecord 가 새 접수에 쓰는 값과 같다 — 단 settleNote 는 비워 둔다(「셈 안 함」 은 새 접수의 말이다).
 * ★RTDB 없음. settlement_events 에 「꼴 맞춤」 이력 한 줄.
 */
import { erp5 } from '../src/adapters/erp5/firestore';
import { intakeRecord, type IntakeInput } from '../src/domain/settlement/intake';
import { intakeEventDocId } from '../src/domain/settlement/code';
import { assertErp5MaintenanceWrite } from '../src/shared/erp5-write-approval';

const APPLY = process.argv.includes('--apply');
assertErp5MaintenanceWrite(process.env, APPLY, 'settlement-shape-fill');
const blank: IntakeInput = {
  receivedAt: '2000-01-01', plate: 'x', model: '', supplier: '', supplierCode: '', customer: '', channel: '', channelCode: '',
  agent: '', agentCode: '', product: '', rentKind: '', contractType: '', term: null, rent: null, deposit: null, price: null,
  payKind: '', paper: false, delivered: false, deliveredAt: '', note: '',
};
/** 줄마다 다른 값(정체)은 기본값으로 채우지 않는다 */
const NOT_DEFAULTED = new Set(['code', 'plate', 'receivedAt', 'createdAt', 'stateAt', 'fromSheet']);
const defaults = Object.fromEntries(Object.entries(intakeRecord(blank, 0)).filter(([k]) => !NOT_DEFAULTED.has(k)));
defaults.settleNote = '';
/** ★가감 세 칸은 오늘(2026-09-18) 새로 생긴 칸이라 기존 461줄에 다 없다 — 채우되 이력은 안 남긴다(461줄 이력이 소음이 된다) */
const NEW_TODAY = new Set(['claimAdjust', 'payAdjust', 'adjustReason']);

const db = erp5();
const snap = await db.collection('settlement_rows').get();
const now = Date.now();
defaults.updatedAt = now;
const todo: { id: string; auditEventId: string; patch: Record<string, unknown> }[] = [];
for (const d of snap.docs) {
  const x = d.data();
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(defaults)) if (!(k in x)) patch[k] = v;
  if (!('stateAt' in x)) patch.stateAt = new Date(now).toISOString();
  if (!('fromSheet' in x) && (x._f04 as { created?: boolean } | undefined)?.created) patch.fromSheet = 'F04 연동';
  if (Object.keys(patch).length) {
    const auditEventId = String(x.auditEventId ?? '').trim() || intakeEventDocId(
      x.plate, x.sourceProductId, x.receivedAt, x.intakeRequestId, x.intakeIdentityMode,
    );
    patch.auditEventId = auditEventId;
    todo.push({ id: d.id, auditEventId, patch });
  }
}
const byCount = new Map<number, number>(); for (const t of todo) byCount.set(Object.keys(t.patch).length, (byCount.get(Object.keys(t.patch).length) ?? 0) + 1);
console.log(`${APPLY ? '★쓴다' : '헛돌기'} · 줄 ${snap.size} · 채울 줄 ${todo.length} · (채울 칸 수: 줄 수) ${[...byCount].map(([k, n]) => `${k}칸:${n}`).join(' ')}`);

if (APPLY) {
  const 묶음 = <T,>(xs: T[], n = 200) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  for (const b of 묶음(todo)) {
    const w = db.batch();
    for (const t of b) {
      w.update(db.collection('settlement_rows').doc(t.id), t.patch);
      if (Object.keys(t.patch).every((k) => NEW_TODAY.has(k))) continue;
      w.set(db.collection('settlement_events').doc(t.auditEventId),
        { [`aud_shape${now}`]: { at: now, by: 'freepass-admin:shape-fill', field: '꼴 맞춤', from: '', to: Object.keys(t.patch).join(',') } }, { merge: true });
    }
    await w.commit();
  }
  console.log(`★썼다 — ${todo.length}줄`);
}
