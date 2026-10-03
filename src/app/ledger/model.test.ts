import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SettlementRow } from '../../domain/settlement/types';
import type { CanonicalProduct } from '../../domain/product/types';
import {
  billMonthsOf, countBy, filterLedger, formatTermInput, formatWonInput, inChip, LEDGER_TABS, inTab, catalogLookupHold, normName, normPlate, parseWon, plateOffers, sortLedger, stepsOf, toLedgerRow,
  toneOf, totalsOf, won, type LedgerRow,
} from './model';

const row = (over: Partial<LedgerRow>): LedgerRow => ({
  code: 'stl_a', receivedAt: '2026-10-01', plate: '12가3456', supplier: '손오공', model: '쏘렌토', channel: '프리패스',
  agent: '김영업', customer: '홍길동', product: '장기렌트', term: 36, rent: 500000, deposit: null, price: null,
  payKind: '일시납', paper: false, delivered: false, deliveredAt: '', billMonth: '', expectedMonth: '', claim: null, pay: null,
  cancelled: false, note: '', task: '계약', block: '계약서', ageDays: 2, ...over,
});

test('toLedgerRow takes task and blocker from the domain and keeps unknown money null', () => {
  const r = toLedgerRow({
    id: 'stl_x', receivedAt: '2026-10-01', plate: '12가3456', supplier: '아이카', model: null, channel: '채널', agent: null,
    customer: null, product: null, term: null, rent: null, deposit: null, price: null, payKind: '일시납', note: null,
    settleTarget: '양쪽',
    progress: { paper: false, delivered: false, deliveredAt: null, billMonth: null, cancelled: false },
    money: { claim: null, pay: 450000 },
  } as unknown as SettlementRow, '2026-10-03');
  assert.equal(r.code, 'stl_x');
  assert.equal(r.task, '계약');
  assert.equal(r.block, '계약서');
  assert.equal(r.claim, null);
  assert.equal(r.pay, 450000);
  assert.equal(r.ageDays, 2);
});

test('tabs split by intake task; 처리 필요 is contract, plate and delivery', () => {
  const rows = [row({ task: '계약' }), row({ task: '차량' }), row({ task: '인도' }), row({ task: '정산' }), row({ task: '완료' }), row({ task: '취소', cancelled: true })];
  assert.deepEqual(countBy(rows, LEDGER_TABS, inTab), { '처리 필요': 3, '정산 대기': 1, '완료': 1, '취소': 1, '전체': 6 });
});

test('chips pick what needs a hand now and never count cancelled rows', () => {
  assert.equal(inChip(row({ task: '계약' }), '계약서 대기'), true);
  assert.equal(inChip(row({ task: '차량' }), '인도 대기'), true);
  assert.equal(inChip(row({ task: '완료', claim: 1, pay: null }), '금액 미확정'), true);
  assert.equal(inChip(row({ task: '취소', cancelled: true }), '금액 미확정'), false);
});

test('filterLedger: chip overrides tab, month uses stamped or expected month, search ignores spaces', () => {
  const rows = [
    row({ code: '1', task: '계약', plate: '12가 3456' }),
    row({ code: '2', task: '정산', billMonth: '2026-10', plate: '34나5678', customer: '이순신', claim: 1, pay: 1 }),
    row({ code: '3', task: '완료', expectedMonth: '2026-09', plate: '56다7890', claim: 1, pay: 1 }),
  ];
  const base = { tab: '처리 필요' as const, chip: null, q: '', month: '' };
  assert.deepEqual(filterLedger(rows, base).map((r) => r.code), ['1']);
  assert.deepEqual(filterLedger(rows, { ...base, tab: '전체', month: '2026-09' }).map((r) => r.code), ['3']);
  assert.deepEqual(filterLedger(rows, { ...base, tab: '전체', q: '12가3456' }).map((r) => r.code), ['1']);
  assert.deepEqual(filterLedger(rows, { ...base, chip: '금액 미확정' }).map((r) => r.code), ['1']);
  assert.deepEqual(billMonthsOf(rows), ['2026-10', '2026-09']);
});

test('sortLedger: 처리 필요 oldest first, others newest first', () => {
  const rows = [row({ code: 'b', receivedAt: '2026-09-30' }), row({ code: 'a', receivedAt: '2026-10-02' })];
  assert.deepEqual(sortLedger(rows, '처리 필요').map((r) => r.code), ['b', 'a']);
  assert.deepEqual(sortLedger(rows, '전체').map((r) => r.code), ['a', 'b']);
});

test('steps and tone follow the task', () => {
  assert.deepEqual(stepsOf(row({ task: '인도' })), ['done', 'done', 'now', 'todo']);
  assert.deepEqual(stepsOf(row({ task: '완료' })), ['done', 'done', 'done', 'done']);
  assert.equal(toneOf(row({ task: '정산', block: '청구금액 확인 필요' })), 'red');
  assert.equal(toneOf(row({ task: '차량', block: '차량번호 없음' })), 'yellow');
  assert.equal(toneOf(row({ task: '완료' })), 'green');
  assert.equal(toneOf(row({ task: '취소' })), 'gray');
});

test('totalsOf skips cancelled rows and counts unknown amounts separately', () => {
  const t = totalsOf([row({ claim: 675000, pay: 540000 }), row({ claim: null, pay: 100000 }), row({ claim: 9, pay: 9, cancelled: true })]);
  assert.deepEqual(t, { rows: 3, claim: 675000, pay: 640000, claimUnknown: 1, payUnknown: 0 });
});

test('input formats: money commas, months, plate and names', () => {
  assert.equal(formatWonInput('1234567원'), '1,234,567');
  assert.equal(formatWonInput(' 500,000 '), '500,000');
  assert.equal(formatWonInput('abc'), 'abc');
  assert.equal(formatWonInput(''), '');
  assert.equal(formatTermInput('36개월'), '36');
  assert.equal(formatTermInput('x'), 'x');
  assert.equal(normPlate(' 12가 3456 '), '12가3456');
  assert.equal(normName('  홍  길동 '), '홍 길동');
});

test('plateOffers: one choice per offer, plate spacing ignored, ledger product kind, unknown stays null', () => {
  const products = [{
    id: 'p1', version: 3, sourceSnapshotId: 'snap1', productKind: '중고렌트', supplierName: '손오공', consumerPrice: null,
    registration: { vehicleNumber: '12가 3456' }, vehicle: { modelId: '쏘렌토', subModelId: 'MQ4' },
    offers: [
      { id: 'o36', termMonths: 36, monthlyRent: 500000, deposit: null, supplierName: undefined },
      { id: 'o48', termMonths: 48, monthlyRent: 450000, deposit: 1000000, supplierName: '손오공렌트' },
    ],
  }, { id: 'p2', registration: { vehicleNumber: '99하9999' }, vehicle: {}, offers: [{ id: 'x' }] },
  { id: 'p3', productKind: '단기렌트', registration: { vehicleNumber: '12가3456' }, vehicle: {}, offers: [{ id: 'y', termMonths: 1, monthlyRent: 1 }] }] as unknown as CanonicalProduct[];
  const r = plateOffers(products, '12가3456');
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { key: 'p1|o36', plate: '12가3456', productId: 'p1', offerId: 'o36', version: 3, snapshot: 'snap1', supplier: '손오공', model: '쏘렌토 MQ4', product: '장기렌트', term: 36, rent: 500000, deposit: null, price: null });
  assert.equal(r[1].supplier, '손오공렌트');
  assert.deepEqual(plateOffers(products, ''), []);
  assert.deepEqual(plateOffers(products, '00가0000'), []);
});

test('plate lookup is held unless the catalog is ACTIVE with complete parity (fail-closed)', () => {
  assert.equal(catalogLookupHold({ authority: 'CANONICAL_ACTIVE', policyParity: 'COMPLETE', commercialCoverage: 'COMPLETE' }), null);
  assert.match(catalogLookupHold(null) ?? '', /확인하지 못했습니다/);
  assert.match(catalogLookupHold({ authority: 'OBSERVE', policyParity: 'COMPLETE', commercialCoverage: 'COMPLETE' }) ?? '', /ACTIVE/);
  assert.match(catalogLookupHold({ authority: 'CANONICAL_ACTIVE', policyParity: 'INCOMPLETE', commercialCoverage: 'COMPLETE' }) ?? '', /정책 검증/);
  assert.match(catalogLookupHold({ authority: 'CANONICAL_ACTIVE', policyParity: 'COMPLETE', commercialCoverage: 'INCOMPLETE' }) ?? '', /거래 조건/);
  assert.match(catalogLookupHold({ authority: 'CANONICAL_ACTIVE', policyParity: 'COMPLETE' }) ?? '', /거래 조건/, 'missing coverage is not complete');
});

test('won and parseWon', () => {
  assert.equal(won(null), '');
  assert.equal(won(1234567), '1,234,567');
  assert.equal(parseWon(''), null);
  assert.equal(parseWon('1,234,567원'), 1234567);
  assert.ok(Number.isNaN(parseWon('abc')));
});
