import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SettlementRow } from '../../domain/settlement/types';
import { billMonthsOf, filterLedger, parseWon, sortLedger, toLedgerRow, totalsOf, won, type LedgerRow } from './model';

const row = (over: Partial<LedgerRow>): LedgerRow => ({
  code: 'stl_a', receivedAt: '2026-10-01', plate: '12가3456', supplier: '손오공', model: '쏘렌토', channel: '프리패스',
  agent: '김영업', customer: '홍길동', product: '장기렌트', term: 36, rent: 500000, deposit: null, price: null,
  payKind: '일시납', paper: false, delivered: false, deliveredAt: '', billMonth: '', claim: null, pay: null,
  cancelled: false, note: '', ...over,
});

test('toLedgerRow keeps unknown money as null, not 0', () => {
  const r = toLedgerRow({
    id: 'stl_x', receivedAt: '2026-10-02', plate: null, supplier: '아이카', model: null, channel: null, agent: null,
    customer: null, product: null, term: null, rent: null, deposit: null, price: null, payKind: null, note: null,
    progress: { paper: true, delivered: false, deliveredAt: null, billMonth: null, cancelled: false },
    money: { claim: null, pay: 450000 },
  } as unknown as SettlementRow);
  assert.equal(r.code, 'stl_x');
  assert.equal(r.plate, '');
  assert.equal(r.paper, true);
  assert.equal(r.claim, null);
  assert.equal(r.pay, 450000);
});

test('sortLedger puts newest intake first and is stable within a day', () => {
  const out = sortLedger([
    row({ code: 'b', receivedAt: '2026-09-30' }),
    row({ code: 'z', receivedAt: '2026-10-02' }),
    row({ code: 'a', receivedAt: '2026-10-02' }),
  ]);
  assert.deepEqual(out.map((r) => r.code), ['a', 'z', 'b']);
});

test('filterLedger by bill month, blank month, search and cancelled', () => {
  const rows = [
    row({ code: '1', billMonth: '2026-09', plate: '12가 3456' }),
    row({ code: '2', billMonth: '2026-10', customer: '이순신', plate: '34나5678' }),
    row({ code: '3', billMonth: '' }),
    row({ code: '4', billMonth: '2026-09', cancelled: true }),
  ];
  const base = { month: '', q: '', showCancelled: false };
  assert.deepEqual(filterLedger(rows, base).map((r) => r.code), ['1', '2', '3']);
  assert.deepEqual(filterLedger(rows, { ...base, month: '2026-09' }).map((r) => r.code), ['1']);
  assert.deepEqual(filterLedger(rows, { ...base, month: '2026-09', showCancelled: true }).map((r) => r.code), ['1', '4']);
  assert.deepEqual(filterLedger(rows, { ...base, month: 'none' }).map((r) => r.code), ['3']);
  assert.deepEqual(filterLedger(rows, { ...base, q: '12가3456' }).map((r) => r.code), ['1', '3']);
  assert.deepEqual(filterLedger(rows, { ...base, q: '이순' }).map((r) => r.code), ['2']);
});

test('billMonthsOf lists distinct months newest first', () => {
  assert.deepEqual(billMonthsOf([row({ billMonth: '2026-09' }), row({ billMonth: '2026-10' }), row({ billMonth: '' }), row({ billMonth: '2026-09' })]), ['2026-10', '2026-09']);
});

test('totalsOf skips cancelled rows and counts unknown amounts separately', () => {
  const t = totalsOf([
    row({ claim: 675000, pay: 540000 }),
    row({ claim: null, pay: 100000 }),
    row({ claim: 999999, pay: 999999, cancelled: true }),
  ]);
  assert.deepEqual(t, { rows: 3, claim: 675000, pay: 640000, claimUnknown: 1, payUnknown: 0 });
});

test('won and parseWon', () => {
  assert.equal(won(null), '');
  assert.equal(won(1234567), '1,234,567');
  assert.equal(parseWon(''), null);
  assert.equal(parseWon('1,234,567원'), 1234567);
  assert.ok(Number.isNaN(parseWon('abc')));
});
