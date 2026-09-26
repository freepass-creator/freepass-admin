import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cashRemainingOf, cashTargetOf, driftOf, invoiceMoneyOf, lifePatch, lifeStageOf, nextInvoiceNo, planInvoice, type LifeChange } from '../lifecycle.js';
import { claimLedger } from '../ledgers.js';
import { toSettlementRow } from '../../../adapters/erp5/to-settlement.js';

const NOW = new Date(2026, 8, 18);
const mk = (o: Record<string, unknown>) => toSettlementRow({
  code: String(o.code ?? 'a'), plate: '1가1', receivedAt: '2026-09-01', supplier: 'A', channel: 'X', paper: true, delivered: true, deliveredAt: '2026-09-03',
  billMonth: '', claimWritten: 1_000_000, payWritten: 800_000, payKind: '일시납', claimStage: '접수', payStage: '접수', ...o,
}, String(o.code ?? 'a')).row;

const ACTION_NOW = Date.parse('2026-09-30T12:00:00+09:00');
const lifePatchAt = (
  r: Parameters<typeof lifePatch>[0],
  change: Parameters<typeof lifePatch>[1],
) => lifePatch(r, change, ACTION_NOW);

describe('문서번호 — FP-S/P-YYYYMM-NNN · 그 달 안에서 순번', () => {
  it('첫 장 · 이어지는 장 · 축마다 따로', () => {
    assert.equal(nextInvoiceNo('2026-09', '공급사', []), 'FP-S-202609-001');
    assert.equal(nextInvoiceNo('2026-09', '공급사', ['FP-S-202609-001', 'FP-S-202609-004', 'FP-P-202609-009']), 'FP-S-202609-005');
    assert.equal(nextInvoiceNo('2026-09', '영업채널', ['FP-S-202609-001']), 'FP-P-202609-001');
  });
});

describe('부가세 — 줄마다 가른다', () => {
  it('별도면 붙이고, 포함이면 나눈다(합이 원래 값과 같다)', () => {
    assert.deepEqual(invoiceMoneyOf(1_000_000, false), { net: 1_000_000, vat: 100_000, total: 1_100_000 });
    assert.deepEqual(invoiceMoneyOf(858_000, true), { net: 780_000, vat: 78_000, total: 858_000 });
  });
});

describe('청구서 발행 계획', () => {
  const rows = [mk({ code: 'a' }), mk({ code: 'b', claimWritten: 500_000 }), mk({ code: 'c', billHold: true })];
  const g = claimLedger(rows, '2026-09', [], NOW).find((x) => x.party === 'A')!;
  it('보류 줄은 빼고 · 환수는 빼고 · 줄에 청구월·청구서·청구 축을 박는다', () => {
    const claw = [{ plate: '9', month: '2026-09', supplier: 'A', channel: 'X', supplierAmt: 100_000, agentAmt: 0, reason: '해지', at: '' }];
    const p = planInvoice('2026-09', '공급사', 'A', g.lines, claw, null, [], NOW.getTime(), 't');
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.equal(p.invoice.invoiceNo, 'FP-S-202609-001');
    assert.equal(p.invoice.lines, 2);
    assert.equal(p.invoice.supply, 1_500_000 - 100_000);
    assert.equal(p.invoice.vat, 150_000 - 10_000);
    assert.deepEqual(p.patches[0].patch, { billMonth: '2026-09', billed: true, billedAt: '2026-09-18', claimStage: '청구' });
  });
  it('재발행은 기존 확인을 초기화해 새 문서를 다시 확인받는다', () => {
    const confirmed = claimLedger([mk({ code: 'confirmed', billed: true, claimStage: '확인', supplierOk: true })], '2026-09', [], NOW)[0];
    const p = planInvoice('2026-09', '공급사', 'A', confirmed.lines, [], { invoiceNo: 'FP-S-202609-003' } as never, [], NOW.getTime(), 't');
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.equal(p.patches[0].patch.claimStage, '청구');
    assert.equal(p.patches[0].patch.supplierOk, false);
  });
  it('일부라도 돈이 움직였거나 계산서 처리 뒤에는 재발행하지 않는다', () => {
    const partialClaim = claimLedger([mk({ code: 'partial', billed: true, claimStage: '확인', collectedAmt: 1 })], '2026-09', [], NOW)[0];
    assert.equal(planInvoice('2026-09', '공급사', 'A', partialClaim.lines, [], { invoiceNo: 'FP-S-202609-001' } as never, [], 0, 't').ok, false);
    const invoiced = claimLedger([mk({ code: 'tax', billed: true, claimStage: '확인', invoiceIssued: true })], '2026-09', [], NOW)[0];
    assert.equal(planInvoice('2026-09', '공급사', 'A', invoiced.lines, [], { invoiceNo: 'FP-S-202609-001' } as never, [], 0, 't').ok, false);
  });
  it('★다시 발행하면 같은 번호', () => {
    const p = planInvoice('2026-09', '공급사', 'A', g.lines, [], { invoiceNo: 'FP-S-202609-003' } as never, [], NOW.getTime(), 't');
    assert.equal(p.ok && p.invoice.invoiceNo, 'FP-S-202609-003');
  });
  it('청구월 미정 · 금액 모름이 섞이면 안 낸다', () => {
    assert.equal(planInvoice('청구월 미정', '공급사', 'A', g.lines, [], null, [], 0, 't').ok, false);
    const bad = claimLedger([mk({ code: 'z', claimWritten: 0 })], '2026-09', [], NOW)[0];
    assert.equal(planInvoice('2026-09', '공급사', 'A', bad.lines, [], null, [], 0, 't').ok, false);
  });
  it('존재하지 않는 월과 잘못된 발행 시각은 문서 발행을 막는다', () => {
    assert.equal(planInvoice('2026-13', '공급사', 'A', g.lines, [], null, [], NOW.getTime(), 't').ok, false);
    assert.equal(planInvoice('2026-09', '공급사', 'A', g.lines, [], null, [], Number.NaN, 't').ok, false);
  });
  it('발행 뒤 원장이 바뀌면 말한다', () =>
    assert.match(driftOf({ supply: 1, vat: 0, lines: 1 } as never, { supply: 2, vat: 0, lines: 1 })!, /공급가/));
});

describe('환수 포함 문서 — 환수는 마이너스 한 줄, 정상 줄은 제 금액으로 수금/지급', () => {
  it('문서 total은 정상 줄 − 환수이고, 각 줄의 수금 목표는 환수에 깎이지 않는다', () => {
    const g = claimLedger([mk({ code: 'a' })], '2026-09', [], NOW).find((x) => x.party === 'A')!;
    const claw = [{ plate: '9', month: '2026-09', supplier: 'A', channel: 'X', supplierAmt: 100_000, agentAmt: 0, reason: '해지', at: '' }];
    const p = planInvoice('2026-09', '공급사', 'A', g.lines, claw, null, [], NOW.getTime(), 't');
    assert.ok(p.ok);
    if (!p.ok) return;
    const row = mk({ code: 'a', billMonth: '2026-09', billed: true, claimStage: '확인', supplierOk: true, invoiceIssued: true });
    const target = cashTargetOf('공급사', row)!;
    assert.equal(p.invoice.clawback, 100_000);
    assert.equal(p.invoice.total, target - 110_000);
    const r = lifePatchAt(row, { kind: 'collected', amount: target, day: '2026-09-30' });
    assert.ok(r.ok, r.ok ? '' : r.error);
  });
});

describe('한 줄의 다음 걸음 — 두 축', () => {
  const billed = mk({ billed: true, claimStage: '청구', payStage: '통보' });
  it('확인 · 정정(사유 필수) · 정정 풂', () => {
    assert.equal(lifePatchAt(mk({}), { kind: 'confirm', axis: '공급사' }).ok, false);           // 청구서 전
    const c = lifePatchAt(billed, { kind: 'confirm', axis: '공급사' });
    assert.deepEqual(c.ok && c.patch, { supplierOk: true, supplierFix: false, claimStage: '확인' });
    assert.equal(lifePatchAt(billed, { kind: 'correct', axis: '공급사', amount: 900_000, memo: '' }).ok, false);
    const x = lifePatchAt(billed, { kind: 'correct', axis: '영업채널', amount: 700_000, memo: '요율 다름' });
    assert.equal(x.ok && x.patch.payStage, '정정');
    const u = lifePatchAt(mk({ billed: true, claimStage: '정정', supplierFix: true }), { kind: 'uncorrect', axis: '공급사' });
    assert.deepEqual(u.ok && u.patch, { supplierFix: false, claimStage: '청구' });
  });
  it('정정 금액은 유한한 0 이상 숫자만 받는다', () => {
    assert.equal(lifePatchAt(billed, { kind: 'correct', axis: '공급사', amount: Number.NaN, memo: '잘못된 입력' }).ok, false);
    assert.equal(lifePatchAt(billed, { kind: 'correct', axis: '공급사', amount: -1, memo: '잘못된 입력' }).ok, false);
    assert.equal(lifePatchAt(billed, { kind: 'correct', axis: '공급사', amount: 0, memo: '0원으로 확인' }).ok, true);
  });
  it('수금 · 지급 · 계산서는 확인 단계를 건너뛰지 않는다', () => {
    assert.equal(lifePatchAt(mk({}), { kind: 'collected', amount: 1, day: '2026-09-30' }).ok, false);
    assert.equal(lifePatchAt(billed, { kind: 'collected', amount: 1_100_000, day: '2026-09-30' }).ok, false);
    assert.equal(lifePatchAt(billed, { kind: 'paid', amount: 800_000, day: '2026-09-30' }).ok, false);

    const supplierConfirmed = mk({ billed: true, invoiceIssued: true, claimStage: '확인', payStage: '통보' });
    const col = lifePatchAt(supplierConfirmed, { kind: 'collected', amount: 1_100_000, day: '2026-09-30' });
    assert.equal(col.ok && col.patch.claimStage, '수금');

    const supplierNoInvoice = mk({ billed: true, invoiceIssued: false, claimStage: '확인', payStage: '통보' });
    assert.equal(lifePatchAt(supplierNoInvoice, { kind: 'collected', amount: 1_100_000, day: '2026-09-30' }).ok, false);

    assert.equal(lifePatchAt(billed, { kind: 'invoice', on: true, day: '2026-09-30' }).ok, false);
    assert.equal(lifePatchAt(mk({ billed: true, claimStage: '확인' }), { kind: 'invoice', on: true, day: '2026-09-30', biz: '123-45-67890' }).ok, true);

    const channelConfirmed = mk({ billed: true, claimStage: '청구', payStage: '확인' });
    const paid = lifePatchAt(channelConfirmed, { kind: 'paid', amount: 880_000, day: '2026-09-30' });
    assert.equal(paid.ok && paid.patch.payStage, '지급');

    assert.equal(lifePatchAt(mk({}), { kind: 'invoice', on: true }).ok, false);
    const invoice = lifePatchAt(mk({ billed: true, claimStage: '확인' }), { kind: 'invoice', on: true, day: '2026-09-30', biz: '123-45-67890' });
    assert.equal(invoice.ok && invoice.patch.invoiceBiz, '1234567890');
    assert.equal(lifePatchAt(mk({ billed: true, claimStage: '확인' }), { kind: 'invoice', on: true, day: '2026-09-30', biz: '123' }).ok, false);
  });
  it('금전 사실 날짜는 실제 달력 날짜이고 미래일 수 없다', () => {
    const confirmed = mk({
      billed: true, billedAt: '2026-09-10', invoiceIssued: true, invoiceAt: '2026-09-20',
      claimStage: '확인', payStage: '확인',
    });
    assert.equal(lifePatchAt(confirmed, { kind: 'collected', amount: 1, day: '2026-02-30' }).ok, false);
    assert.equal(lifePatchAt(confirmed, { kind: 'paid', amount: 1, day: '2026-10-01' }).ok, false);
    assert.equal(lifePatchAt(confirmed, { kind: 'collected', amount: 1, day: '2026-09-19' }).ok, false);
    assert.equal(lifePatchAt(
      mk({ billed: true, billedAt: '2026-09-10', claimStage: '확인' }),
      { kind: 'invoice', on: true, day: '2026-10-01', biz: '123-45-67890' },
    ).ok, false);
  });

  it('부분수금/부분지급은 누적하고 전액에 닿을 때만 완료한다', () => {
    const supplierConfirmed = mk({ billed: true, invoiceIssued: true, claimStage: '확인', collectedAmt: 0 });
    const p1 = lifePatchAt(supplierConfirmed, { kind: 'collected', amount: 400_000, day: '2026-09-20' });
    assert.ok(p1.ok);
    assert.equal(p1.ok && p1.patch.collected, false);
    assert.equal(p1.ok && p1.patch.claimStage, '확인');
    assert.equal(p1.ok && p1.patch.collectedAmt, 400_000);

    const afterP1 = mk({ billed: true, invoiceIssued: true, claimStage: '확인', collectedAmt: 400_000, collected: false });
    assert.equal(cashRemainingOf('공급사', afterP1), 700_000);
    const p2 = lifePatchAt(afterP1, { kind: 'collected', amount: 700_000, day: '2026-09-30' });
    assert.equal(p2.ok && p2.patch.collected, true);
    assert.equal(p2.ok && p2.patch.claimStage, '수금');
    assert.equal(p2.ok && p2.patch.collectedAmt, 1_100_000);

    const channelConfirmed = mk({ billed: true, payStage: '확인', paidAmt: 0 });
    const q1 = lifePatchAt(channelConfirmed, { kind: 'paid', amount: 300_000, day: '2026-09-20' });
    assert.equal(q1.ok && q1.patch.paid, false);
    const afterQ1 = mk({ billed: true, payStage: '확인', paidAmt: 300_000, paid: false });
    assert.equal(cashRemainingOf('영업채널', afterQ1), 580_000);
    const q2 = lifePatchAt(afterQ1, { kind: 'paid', amount: 580_000, day: '2026-09-30' });
    assert.equal(q2.ok && q2.patch.paid, true);
    assert.equal(q2.ok && q2.patch.paidAmt, 880_000);
  });
  it('정정 중 확인과 완료 뒤 정정을 막고, 수금 뒤 계산서 취소도 막는다', () => {
    assert.equal(lifePatchAt(mk({ billed: true, claimStage: '정정' }), { kind: 'confirm', axis: '공급사' }).ok, false);
    assert.equal(lifePatchAt(mk({ billed: true, claimStage: '수금' }), { kind: 'correct', axis: '공급사', amount: 1, memo: '뒤늦은 변경' }).ok, false);
    assert.equal(lifePatchAt(mk({ payStage: '지급' }), { kind: 'correct', axis: '영업채널', amount: 1, memo: '뒤늦은 변경' }).ok, false);
    assert.equal(lifePatchAt(mk({ billed: true, invoiceIssued: true, collected: true, claimStage: '수금' }), { kind: 'invoice', on: false }).ok, false);
    assert.equal(lifePatchAt(mk({ billed: true, invoiceIssued: true, collected: false, collectedAmt: 1, claimStage: '확인' }), { kind: 'invoice', on: false }).ok, false);
  });
  it('청구월 정하기 — 인도된 · 청구 전 줄만', () => {
    assert.deepEqual((lifePatchAt(mk({}), { kind: 'billMonth', month: '2026-10' }) as { patch: unknown }).patch, { billMonth: '2026-10' });
    assert.equal(lifePatchAt(mk({ delivered: false, deliveredAt: '' }), { kind: 'billMonth', month: '2026-10' }).ok, false);
    assert.equal(lifePatchAt(billed, { kind: 'billMonth', month: '2026-10' }).ok, false);
  });
  it('존재하지 않는 청구월은 수동 확정하지 않는다', () => {
    assert.equal(lifePatchAt(mk({}), { kind: 'billMonth', month: '2026-13' }).ok, false);
    assert.equal(lifePatchAt(mk({}), { kind: 'billMonth', month: '2026-00' }).ok, false);
  });
  it('두 축을 한 낱말로 — 덜 간 쪽 · 정정이 이긴다', () => {
    assert.equal(lifeStageOf('수금', '통보'), '통보');
    assert.equal(lifeStageOf('청구', '정정'), '정정');
    assert.equal(lifeStageOf('수금', '지급', '보류'), '보류');
  });
});


it('정산 lifecycle mutation은 delivery eligibility를 우회하지 못한다', () => {
  const dirty = mk({
    paper: true,
    delivered: false,
    deliveredAt: '',
    billMonth: '2026-09',
    claimStage: '청구',
    payStage: '통보',
  });
  const changes: LifeChange[] = [
    { kind: 'confirm', axis: '공급사' },
    { kind: 'confirm', axis: '영업채널' },
    { kind: 'billMonth', month: '2026-09' },
  ];
  for (const change of changes) {
    const r = lifePatchAt(dirty, change);
    assert.equal(r.ok, false);
    assert.match(String((r as { error?: string }).error), /인도완료/);
  }
});
