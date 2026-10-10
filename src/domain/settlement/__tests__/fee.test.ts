import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dataFeeAmount, dataFeeLabel, readDataFee, receiptRowBasis } from '../fee.js';
import { intakeDataFees, intakeRecord, feeManualErrors, type IntakeInput } from '../intake.js';
import type { TermEconomicAmount } from '../../product/types.js';
import { toSettlementRow } from '../../../adapters/erp5/to-settlement.js';

// 모든 금액·식별자는 실제 거래와 무관한 시험값이다.
const economic = (state: TermEconomicAmount['state'], amount: number | null = null): TermEconomicAmount => ({
  state, amount: amount === null ? null : { amount, currency: 'KRW' },
  sourceRefs: ['synthetic-source'], ruleId: 'synthetic-rule', policyId: 'synthetic-policy',
  calculation: { kind: 'RATE', base: 'VEHICLE_PRICE', rate: 0.19 },
});
const base: IntakeInput = {
  receivedAt: '2026-10-10', plate: '', intakeRequestId: 'synthetic-request', model: '예시모델',
  supplier: '예시공급사A', supplierCode: '', customer: '예시고객', channel: '예시채널', channelCode: '',
  agent: '예시담당', agentCode: '', product: '신차발주', rentKind: '신차렌트', contractType: '',
  term: 1, rent: 7, deposit: null, price: 9, payKind: '일시납', paper: false, delivered: false, deliveredAt: '', note: '',
};
const input = (claim?: TermEconomicAmount, pay?: TermEconomicAmount): IntakeInput => ({
  ...base, sourceProductId: 'synthetic-product', catalogSnapshot: {
    capturedAt: '2026-10-10T00:00:00Z', product: {} as NonNullable<IntakeInput['catalogSnapshot']>['product'],
    offer: { id: 'synthetic-offer#term-a', termKey: 'term-a', termMonths: 1, monthlyRent: 7,
      deposit: null, prepayment: null, annualMileageKm: null, policyValues: [],
      supplierBillingFee: claim, channelPayoutFee: pay },
  },
});

describe('Data 내부 수수료 저장값 읽기', () => {
  it('KNOWN 값은 소수도 그대로 읽고 calculation을 실행하지 않는다', () => {
    const fee = economic('KNOWN', 7.9);
    assert.equal(dataFeeAmount(fee), 7.9);
    assert.deepEqual(readDataFee(fee), { status: 'CONFIRMED', state: 'KNOWN', amount: 7.9, reasonCode: null,
      ruleId: fee.ruleId, policyId: fee.policyId, sourceRefs: fee.sourceRefs });
  });
  it('ZERO와 NOT_APPLICABLE과 UNKNOWN을 구분한다', () => {
    assert.equal(dataFeeAmount(economic('ZERO', 0)), 0);
    const na = readDataFee(economic('NOT_APPLICABLE'));
    assert.equal(na.status, 'CONFIRMED'); assert.equal(na.amount, null);
    assert.equal(dataFeeLabel(economic('NOT_APPLICABLE')), '해당 없음');
    const unknown = readDataFee({ ...economic('UNKNOWN'), reasonCode: 'SYNTHETIC_REASON' });
    assert.equal(unknown.status, 'UNCONFIRMED'); assert.equal(unknown.amount, null);
    assert.equal(unknown.reasonCode, 'SYNTHETIC_REASON');
    assert.deepEqual(unknown.sourceRefs, ['synthetic-source']);
  });
  it('누락·잘못된 KNOWN은 이유 없는 0으로 바꾸지 않는다', () => {
    for (const fee of [undefined, economic('UNKNOWN'), economic('KNOWN'), economic('KNOWN', NaN), economic('KNOWN', Infinity), economic('KNOWN', -1)]) {
      assert.equal(readDataFee(fee).reasonCode, 'REASON_NOT_RECORDED');
      assert.equal(dataFeeAmount(fee), null);
    }
    assert.notEqual(readDataFee(economic('KNOWN', 0)).status, 'UNCONFIRMED');
    assert.equal(toSettlementRow(intakeRecord(input(economic('KNOWN', 0)), 0), 'synthetic-row').row.money.claim, 0);
  });
  it('기간과 양쪽 provenance를 보존하고 원장 재읽기에서도 0을 지킨다', () => {
    const x = input(economic('ZERO', 0), economic('KNOWN', 7));
    const data = intakeDataFees(x);
    assert.equal(data.termKey, 'term-a');
    assert.equal(data.supplierBillingFee.ruleId, 'synthetic-rule');
    assert.deepEqual(data.channelPayoutFee.sourceRefs, ['synthetic-source']);
    const record = intakeRecord(x, 0), row = toSettlementRow(record, 'synthetic-row').row;
    assert.deepEqual([record.claimWritten, record.payWritten, row.money.claim, row.money.pay], [0, 7, 0, 7]);
    assert.deepEqual(record.catalogSnapshot, x.catalogSnapshot);
  });
  it('부분 미확정·직접접수·상품 snapshot 누락은 요율 fallback 없이 null로 저장한다', () => {
    for (const x of [base, { ...base, sourceProductId: 'synthetic-product' }, input()]) {
      const record = intakeRecord(x, 0);
      assert.deepEqual([record.claimWritten, record.payWritten, record.supplierRate, record.agentRate], [null, null, null, null]);
      assert.match(String(record.settleNote), /REASON_NOT_RECORDED/);
    }
    const record = intakeRecord(input(economic('UNKNOWN'), economic('ZERO', 0)), 0);
    assert.deepEqual([record.claimWritten, record.payWritten], [null, 0]);
    assert.match(String(intakeRecord(input(economic('NOT_APPLICABLE')), 0).settleNote), /CONFIRMED · NOT_APPLICABLE/);
  });
  it('사유 있는 폼 입력도 저장값을 덮어쓰지 않는다', () => {
    const x = { ...input(economic('UNKNOWN'), economic('KNOWN', 7)), feeManual: { claim: 0, pay: 9, reason: '예시 사유' } };
    assert.equal(feeManualErrors(x).length, 1);
    assert.deepEqual([intakeRecord(x, 0).claimWritten, intakeRecord(x, 0).payWritten], [null, 7]);
    assert.deepEqual(feeManualErrors({ ...input(economic('KNOWN', 7), economic('ZERO', 0)), feeManual: { claim: 7, pay: 0, reason: '' } }), []);
  });
  it('과거 금액 표시는 현재 요율로 재계산하지 않는다', () => {
    assert.match(receiptRowBasis({ sourceReceiptClaim: 7, sourceReceiptPay: null }).claim, /기재액 7원/);
    assert.equal(receiptRowBasis({ sourceReceiptPay: null }).pay, '미확정');
  });
});
