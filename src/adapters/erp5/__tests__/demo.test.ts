import assert from 'node:assert/strict';
import test from 'node:test';

import { DEMO_READ_ONLY, demoMode } from '../demo';
import { erp5, erp5App, erp5Ready } from '../firestore';
import { writeEnabled } from '../settlement-repository';
import { contracts, productList, settlements } from '../../../server/erp5';
import { BUCKETS, bucketOf } from '../../../domain/settlement/stage';

const KEYS = ['FPA_DEMO', 'VERCEL_ENV', 'ERP5_WRITE'] as const;

/** 환경을 잠깐 바꾸고 되돌린다 — 다른 시험에 새지 않게. */
function withEnv(t: test.TestContext, env: Partial<Record<(typeof KEYS)[number], string | undefined>>) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) {
    const v = env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  t.after(() => {
    for (const k of KEYS) {
      const v = saved[k];
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
}

test('가상 데이터 모드는 기본으로 꺼져 있다', (t) => {
  withEnv(t, {});
  assert.equal(demoMode(), false);
});

test('FPA_DEMO=on 이면 켜진다', (t) => {
  withEnv(t, { FPA_DEMO: 'on' });
  assert.equal(demoMode(), true);
  assert.deepEqual(erp5Ready(), { ok: true, project: 'demo' });
});

test('운영 배포(VERCEL_ENV=production)에서는 FPA_DEMO=on 이어도 꺼진다', (t) => {
  withEnv(t, { FPA_DEMO: 'on', VERCEL_ENV: 'production' });
  assert.equal(demoMode(), false);
});

test('미리보기 배포(VERCEL_ENV=preview)에서는 켤 수 있다', (t) => {
  withEnv(t, { FPA_DEMO: 'on', VERCEL_ENV: 'preview' });
  assert.equal(demoMode(), true);
});

test('가상 데이터 모드에서는 ERP5_WRITE=on 이어도 쓰기 열쇠가 닫힌다', (t) => {
  withEnv(t, { FPA_DEMO: 'on', ERP5_WRITE: 'on' });
  assert.equal(writeEnabled(), false);
});

test('가상 데이터 모드에서는 Storage(erp5App)에 붙지 않는다', (t) => {
  withEnv(t, { FPA_DEMO: 'on' });
  assert.throws(() => erp5App(), /가상 데이터 모드/);
});

test('가짜 Firestore 의 쓰기는 모두 던진다', async (t) => {
  withEnv(t, { FPA_DEMO: 'on' });
  const db = erp5();
  const ref = db.collection('settlement_rows').doc('stl_demo_001');
  const ro = new RegExp(DEMO_READ_ONLY);
  assert.throws(() => ref.set({ x: 1 }), ro);
  assert.throws(() => ref.update({ x: 1 }), ro);
  assert.throws(() => ref.create({ x: 1 }), ro);
  assert.throws(() => ref.delete(), ro);
  assert.throws(() => db.collection('settlement_rows').add({ x: 1 }), ro);
  assert.throws(() => db.batch(), ro);
  await assert.rejects(
    db.runTransaction(async (tx) => { const d = await tx.get(ref); assert.equal(d.exists, true); tx.update(ref, { x: 1 }); }),
    ro,
  );
});

test('가짜 Firestore 읽기 — doc · where · limit · data() 사본', async (t) => {
  withEnv(t, { FPA_DEMO: 'on' });
  const db = erp5();
  const doc = await db.collection('settlement_rules').doc('current').get();
  assert.equal(doc.exists, true);
  assert.equal(typeof doc.updateTime?.toMillis(), 'number');
  const missing = await db.collection('products').doc('없는차').get();
  assert.equal(missing.exists, false);
  assert.equal(missing.data(), undefined);
  const hit = await db.collection('products').where('product_code', '==', 'FP-0003').limit(1).get();
  assert.equal(hit.size, 1);
  assert.equal(hit.empty, false);
  const first = hit.docs[0].data()!;
  first.product_code = 'changed';
  const again = await db.collection('products').where('product_code', '==', 'FP-0003').get();
  assert.equal(again.docs[0].data()!.product_code, 'FP-0003', '호출자가 고쳐도 가짜 원장은 안 바뀐다');
  const none = await db.collection('settlement_invoices').where('month', '==', '2026-01').get();
  assert.equal(none.empty, true);
});

test('실제 repository 가 가상 데이터를 그대로 읽는다 — 상품 · 정산 · 계약', async (t) => {
  withEnv(t, { FPA_DEMO: 'on' });
  const { rows: products, report } = await productList();
  assert.ok(products.length >= 20, `상품 ${products.length}`);
  assert.equal(report?.docs, 24);
  assert.equal(report?.project, 'demo');

  const rows = await settlements.list();
  assert.ok(rows.length >= 18, `정산 ${rows.length}`);
  const buckets = new Set(rows.map((x) => bucketOf(x.row)));
  for (const b of BUCKETS) assert.ok(buckets.has(b), `칸 「${b}」 이 비었다`);
  assert.ok((await settlements.clawbacks()).length >= 1);
  assert.deepEqual(await settlements.invoices('2026-01'), []);
  assert.ok(await settlements.get('stl_demo_001'));

  const list = await contracts.list();
  assert.ok(list.length >= 10, `계약 ${list.length}`);
  for (const s of ['계약요청', '계약대기', '계약완료', '계약취소']) {
    assert.ok(list.some((c) => c.status === s), `계약 상태 「${s}」 가 없다`);
  }
});

test('가상 데이터 모드에서 정산 쓰기는 ERP5_WRITE=on 이어도 막힌다', async (t) => {
  withEnv(t, { FPA_DEMO: 'on', ERP5_WRITE: 'on' });
  await assert.rejects(settlements.setProgress('stl_demo_001', { kind: 'paper', value: true } as never), /ERP5 쓰기가 꺼져/);
});
