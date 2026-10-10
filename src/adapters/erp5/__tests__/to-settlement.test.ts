import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feeOf, toSettlementRow } from '../to-settlement.js';
import { blockOf, isOpenIntake, isPerformance, margin } from '../../../domain/settlement/types.js';
import { stageEvidenceOf } from '../../../domain/settlement/stage.js';

/* 값은 ERP5(freepasserp5) settlement_rows 461줄 실측에서 그대로 딴 것이다. */

describe('feeOf — ★한 칸에 비율과 정액이 섞여 있었다', () => {
  it('1 이하는 비율이다', () => {
    assert.deepEqual(feeOf(0.0325, '공급사'), { mode: 'RATE', rate: 0.0325, note: '1 이하라 비율로 읽었다' });
    assert.equal(feeOf(0.025, '영업채널').mode, 'RATE');
  });
  it('★1 을 넘으면 정액이다 — 비율로 읽으면 20조가 나온다', () => {
    const f = feeOf(1_000_000, '공급사');
    assert.equal(f.mode, 'FLAT');
    if (f.mode === 'FLAT') assert.equal(f.amount, 1_000_000);
  });
  it('0 은 「요율 0%」가 아니라 «안 적은 것» 이다', () => {
    assert.equal(feeOf(0, '공급사').mode, 'UNKNOWN');
    assert.equal(feeOf('', '공급사').mode, 'UNKNOWN');
  });
  it('판정한 까닭을 줄에 남긴다', () => {
    assert.match(String(feeOf(1_000_000, '공급사').note), /정액/);
    assert.match(String(feeOf(0, '공급사').note), /모른다/);
  });
});

describe('청구금액 0 을 어떻게 읽나', () => {
  const base = { code: 'stl_x', plate: 'PLATE_BASE', supplier: '예시공급사B', receivedAt: '2026-08-01' };

  it('★끝난 줄의 0 은 «사실» 이다 — 대표 「5월은 이미 다 한거고」', () => {
    const { row, warnings } = toSettlementRow(
      { ...base, claimWritten: 0, payWritten: 800_000, billed: true, payStage: '통보' }, 'd');
    assert.equal(row.money.claim, 0);
    assert.equal(warnings.filter((w) => w.includes('청구금액이 0')).length, 0);
  });
  it('아직 «안 끝난» 줄의 0 은 «모른다» 다', () => {
    const { row, warnings } = toSettlementRow(
      { ...base, claimWritten: 0, payWritten: 800_000, billed: true, payStage: '접수' }, 'd');
    assert.equal(row.money.claim, null);
    assert.ok(warnings.some((w) => w.includes('모른다로 둔다')));
  });
  it('칸 자체가 비면 모른다', () => {
    const { row } = toSettlementRow({ ...base }, 'd');
    assert.equal(row.money.claim, null);
  });
});

describe('저장된 수수료 상태 — «해당 없음»과 «모름»을 다시 읽을 때 구분한다', () => {
  const base = { code: 'stl_x', plate: 'PLATE_BASE', supplier: '예시공급사B', receivedAt: '2026-10-01', sourceProductId: 'prd_x' };
  const snapshot = (billing: unknown, payout: unknown) => ({
    product: {}, offer: { id: 'off_x', termMonths: 12, monthlyRent: 1_000_000, deposit: null, prepayment: null,
      supplierBillingFee: billing, channelPayoutFee: payout },
  });
  const notApplicable = { state: 'NOT_APPLICABLE', sourceRefs: [] };
  const unknown = { state: 'UNKNOWN', reasonCode: 'NO_EVIDENCE', sourceRefs: [] };

  it('금액 칸이 비어 있어도 저장된 상태가 «해당 없음»이면 확정이다(청구·지급 0, 미확정 경고 없음)', () => {
    const { row, warnings } = toSettlementRow(
      { ...base, claimWritten: null, payWritten: null, catalogSnapshot: snapshot(notApplicable, notApplicable) }, 'd');
    assert.equal(row.money.claim, 0);
    assert.equal(row.money.pay, 0);
    assert.equal(warnings.filter((w) => w.includes('청구금액 칸이 비어 있다')).length, 0);
  });
  it('저장된 상태가 «모름»이면 금액 칸이 비어 있는 그대로 미확정이다(경고 있음)', () => {
    const { row, warnings } = toSettlementRow(
      { ...base, claimWritten: null, payWritten: null, catalogSnapshot: snapshot(unknown, unknown) }, 'd');
    assert.equal(row.money.claim, null);
    assert.equal(row.money.pay, null);
    assert.ok(warnings.some((w) => w.includes('청구금액 칸이 비어 있다')));
  });
  it('상품 없이 직접 접수한 줄은 스냅샷이 있어도 «해당 없음»으로 읽지 않는다', () => {
    const { row } = toSettlementRow(
      { ...base, sourceProductId: '', claimWritten: null, payWritten: null, catalogSnapshot: snapshot(notApplicable, notApplicable) }, 'd');
    assert.equal(row.money.claim, null);
    assert.equal(row.money.pay, null);
  });
});

describe('★빈칸을 0 으로 만들지 않는다', () => {
  it('차량가액 0 은 «0원짜리 차» 가 아니다 — 신차만 값이 있다', () => {
    const { row } = toSettlementRow({ code: 'c', price: 0 }, 'd');
    assert.equal(row.price, null);
  });
  it('보증금 0 은 무보증 — 사실이므로 그대로 둔다', () => {
    const { row } = toSettlementRow({ code: 'c', deposit: 0 }, 'd');
    assert.equal(row.deposit, 0);
  });
});

describe('열쇠가 없으면 말한다', () => {
  it('차량번호가 없으면 경고한다 — 정산에서 못 붙는다', () => {
    const { warnings } = toSettlementRow({ code: 'c', supplier: '예시공급사A' }, 'd');
    assert.ok(warnings.some((w) => w.includes('차량번호가 없다')));
  });
  it('공급사가 없으면 청구할 곳이 없다', () => {
    const { warnings } = toSettlementRow({ code: 'c', plate: 'PLATE_ROW' }, 'd');
    assert.ok(warnings.some((w) => w.includes('공급사가 없다')));
  });
  it('정산비율이 1 이 아닌데 까닭이 없으면 말한다', () => {
    const { warnings } = toSettlementRow({ code: 'c', plate: 'p', supplier: 's', settleRatio: 0.5 }, 'd');
    assert.ok(warnings.some((w) => w.includes('까닭이 안 적혀')));
  });
});

describe('실적이냐 접수냐', () => {
  const mk = (o: Record<string, unknown>) =>
    toSettlementRow({ code: 'c', plate: 'PLATE_ROW', supplier: '예시공급사A', ...o }, 'd').row;

  it('인도가 찍혀야 실적이다', () => {
    assert.equal(isPerformance(mk({ delivered: true })), true);
    assert.equal(isPerformance(mk({ delivered: false })), false);
  });
  it('취소된 것은 실적도 접수도 아니다', () => {
    const r = mk({ delivered: true, cancelled: true });
    assert.equal(isPerformance(r), false);
    assert.equal(isOpenIntake(r), false);
  });
  it('인도 전이면 «아직 접수» 다', () => {
    assert.equal(isOpenIntake(mk({ delivered: false })), true);
  });
});

describe('margin — ★청구를 «모르면» 마진도 모른다', () => {
  const mk = (o: Record<string, unknown>) =>
    toSettlementRow({ code: 'c', plate: 'p', supplier: 's', billed: true, payStage: '통보', ...o }, 'd').row;
  it('셈이 된다', () => {
    assert.equal(margin(mk({ claimWritten: 1_000_000, payWritten: 800_000 })), 200_000);
  });
  it('청구를 모르면 0 이 아니라 null 이다', () => {
    const r = toSettlementRow({ code: 'c', plate: 'p', supplier: 's', payWritten: 800_000 }, 'd').row;
    assert.equal(margin(r), null);
  });
});

describe('blockOf — ★「무엇이 있나」가 아니라 「무엇을 하나」', () => {
  const mk = (o: Record<string, unknown>) =>
    toSettlementRow({ code: 'c', plate: 'PLATE_ROW', supplier: '예시공급사A', channel: '영업사', ...o }, 'd').row;

  it('계약 → 차량번호 → 상대 정보 순서로 막는다', () => {
    assert.equal(blockOf(toSettlementRow({ code: 'c' }, 'd').row), '계약서');
    assert.equal(blockOf(toSettlementRow({ code: 'c', paper: true }, 'd').row), '차량번호 없음');
    assert.equal(blockOf(toSettlementRow({ code: 'c', paper: true, plate: 'p' }, 'd').row), '공급사 없음');
  });
  it('계약서 → 인도 차례로 막는다', () => {
    assert.equal(blockOf(mk({})), '계약서');
    assert.equal(blockOf(mk({ paper: true })), '인도');
  });
  it('인도된 뒤엔 돈이 막는다', () => {
    assert.equal(blockOf(mk({ paper: true, delivered: true })), '청구금액 모름');
    assert.equal(blockOf(mk({ paper: true, delivered: true, claimWritten: 100, billed: true, payStage: '통보' })), '계산서');
  });
  it('★수금·지급이 마지막 관문이다 — 461줄 중 켜진 것이 0 이다', () => {
    const r = mk({ paper: true, delivered: true, claimWritten: 100, payWritten: 80, channel: '영업사', billed: true, payStage: '통보', invoiceIssued: true });
    assert.equal(blockOf(r), '수금');
    const r2 = mk({ paper: true, delivered: true, claimWritten: 100, payWritten: 80, channel: '영업사', billed: true, payStage: '통보', invoiceIssued: true, collected: true });
    assert.equal(blockOf(r2), '지급');
  });
  it('취소된 줄은 안 막힌다 — 할 일이 없다', () => {
    assert.equal(blockOf(mk({ cancelled: true })), null);
  });
  it('다 끝나면 null', () => {
    const r = mk({ paper: true, delivered: true, claimWritten: 100, billed: true, payStage: '통보', invoiceIssued: true, collected: true, paid: true });
    assert.equal(blockOf(r), null);
  });
});


it('계약해지 provenance를 ERP5 정산행에서 그대로 읽는다', () => {
  const { row } = toSettlementRow({
    code:'stl_term',
    contractTerminatedAt:Date.parse('2026-09-25T00:00:00Z'),
    contractTerminationDate:'2026-09-25',
    contractTerminationReason:'중도해지',
    contractTerminationOperationId:'terminate_1234567890abcdef',
    contractTerminationContractId:'ctr_term_1',
  }, 'stl_term');
  assert.equal(row.contractTerminationDate,'2026-09-25');
  assert.equal(row.contractTerminationReason,'중도해지');
  assert.equal(row.contractTerminationOperationId,'terminate_1234567890abcdef');
  assert.equal(row.contractTerminationContractId,'ctr_term_1');
});

it('계약해지 환수 검토 사실을 정산행 projection에서 그대로 읽는다', () => {
  const reviewedAt = Date.parse('2026-09-27T00:00:00Z');
  const { row } = toSettlementRow({
    code: 'stl_claw_review',
    contractTerminatedAt: Date.parse('2026-09-25T00:00:00Z'),
    contractTerminationDate: '2026-09-25',
    contractClawbackReviewDecision: 'REQUIRED',
    contractClawbackReviewedAt: reviewedAt,
    contractClawbackReviewReason: '3개월 유지조건 미충족',
    contractClawbackReviewOperationId: 'clawreview_projection_1234',
  }, 'stl_claw_review');
  assert.equal(row.contractClawbackReviewDecision, 'REQUIRED');
  assert.equal(row.contractClawbackReviewedAt, reviewedAt);
  assert.equal(row.contractClawbackReviewReason, '3개월 유지조건 미충족');
  assert.equal(row.contractClawbackReviewOperationId, 'clawreview_projection_1234');
});

describe('계약금 수납 projection', () => {
  it('완전한 계약금 수납 사실은 보증금/선납과 별도로 읽는다', () => {
    const { row, warnings } = toSettlementRow({
      code: 'c',
      plate: 'PLATE_ROW',
      supplier: '예시공급사A',
      deposit: 0,
      prepaid: 300000,
      contractPaymentAmount: 500000,
      contractPaymentReceivedAt: 1000,
      contractPaymentOperationId: 'contractpay_1234567890abcdef',
      contractPaymentReceiptId: 'bank-1',
      contractPaymentBy: '관리자',
    }, 'd');
    assert.equal(row.deposit, 0);
    assert.equal(row.money.prepaid, 300000);
    assert.equal(row.contractPayment?.amount, 500000);
    assert.equal(row.contractPayment?.receiptId, 'bank-1');
    assert.equal(warnings.some((w) => w.includes('계약금 수납 기록 불완전')), false);
  });

  it('부분 계약금 기록은 계약금 없음으로 숨기지 않고 경고한다', () => {
    const { row, warnings } = toSettlementRow({
      code: 'c',
      plate: 'PLATE_ROW',
      supplier: '예시공급사A',
      contractPaymentAmount: 500000,
    }, 'd');
    assert.equal(row.contractPayment, null);
    assert.ok(warnings.some((w) => w.includes('계약금 수납 기록 불완전')));
  });
});



describe('F04 legacy installment round compatibility', () => {
  it('legacy rounds field is restored as paidRounds', () => {
    const { row } = toSettlementRow({
      code: 'stl_legacy_rounds',
      plate: 'PLATE_ROW',
      supplier: '공급사',
      payKind: '3회분납',
      rounds: 2,
    }, 'stl_legacy_rounds');
    assert.equal(row.paidRounds, 2);
  });

  it('current paidRounds wins over legacy rounds when both exist', () => {
    const { row } = toSettlementRow({
      code: 'stl_current_rounds',
      plate: 'PLATE_ROW',
      supplier: '공급사',
      payKind: '3회분납',
      paidRounds: 3,
      rounds: 2,
    }, 'stl_current_rounds');
    assert.equal(row.paidRounds, 3);
  });

  it('keeps F04 import provenance after migration', () => {
    const { row } = toSettlementRow({
      code: 'stl_source', plate: 'PLATE_A', receivedAt: '2026-09-21',
      fromSheet: 'F04 연동', _f04: { tab: '접수', row: 67, run: 'f04fill-20260928', at: '2026-09-28T03:00:00.000Z' },
    }, 'stl_source');
    assert.deepEqual(row.source, {
      sheet: 'F04 연동', tab: '접수', rowNo: 67,
      importRun: 'f04fill-20260928', importedAt: '2026-09-28T03:00:00.000Z',
      originalPlate: 'PLATE_A',
    });
  });

  it('derives current state from facts instead of the source tab', () => {
    const cancelled = toSettlementRow({
      code: 'stl_cancelled', plate: 'PLATE_A', receivedAt: '2026-09-21',
      sourceTab: '접수', delivered: true, payKind: '2회분납', cancelled: true,
    }, 'stl_cancelled').row;
    assert.deepEqual(stageEvidenceOf(cancelled), {
      state: '취소', reason: '취소 사실이 기록돼 있습니다.',
    });

    const installment = toSettlementRow({
      code: 'stl_installment', plate: 'PLATE_B', receivedAt: '2026-09-22',
      sourceTab: '접수', delivered: true, deliveredAt: '2026-09-22', payKind: '2회분납', paidRounds: 1,
    }, 'stl_installment').row;
    assert.deepEqual(stageEvidenceOf(installment, new Date('2026-09-28T00:00:00Z')), {
      state: '분납실적', reason: '인도완료 후 2회 분납 진행 중 · 납입 1회차.',
    });

    const unknownPayKind = toSettlementRow({
      code: 'stl_unknown_pay', plate: 'PLATE_C', receivedAt: '2026-09-23',
      sourceTab: '완납실적', delivered: true,
    }, 'stl_unknown_pay').row;
    assert.deepEqual(stageEvidenceOf(unknownPayKind), {
      state: '접수', reason: '유효한 인도완료일이 아직 없습니다.',
    });
  });
});
