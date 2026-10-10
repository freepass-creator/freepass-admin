import test from 'node:test';
import assert from 'node:assert/strict';
import { toSettlementRow } from '../../../adapters/erp5/to-settlement';
import { NO_MONTH } from '../ledgers';
import { settlementSummary, settlementSummaryCsv, settlementSummaryRows, feeLinkText,
  CONTRACT_FEE_REASON_LABELS, SETTLEMENT_SUMMARY_HEADERS } from '../summary';
import { adminBlockLabel, blockOf } from '../types';
import { readContractFeeLinks } from '../../../adapters/freepass-data/contract-fee-links';
import { CONTRACT_FEE_LINK_FAILURES, type ContractFeeLinkResult,
  type ContractFeeLinkItem } from '../../../ports/admin-catalog-reader';

// 전부 가상 값. 실제 차량번호·고객·원천 식별자는 사용하지 않는다.
const NOW = new Date('2030-03-01T00:00:00Z');
function row(over: Record<string, unknown> = {}) {
  return toSettlementRow({
    plate: 'EXAMPLE',
    supplier: '예시공급사A', paper: true, delivered: true, deliveredAt: '2030-02-01',
    billMonth: '2030-02', billed: true, payStage: '통보', claimWritten: 123, payWritten: 45,
    ...over,
  }, 'example-row').row;
}

test('공급사별 확정/미확정, 실제 0과 모름, 총합과 양쪽 확정분 우리 몫', () => {
  const s = settlementSummary([
    row(), row({ claimWritten: 0, payWritten: 0 }),
    row({ claimWritten: null, payWritten: 17 }),
    row({ supplier: '예시공급사B', claimWritten: 29, payWritten: null }),
    row({ supplier: '예시공급사C', claimWritten: null, payWritten: null }),
  ], '2030-02', NOW);
  assert.deepEqual(s.suppliers[0], { supplier: '예시공급사A', count: 3, claim: 123, claimUnknown: 1, pay: 62, payUnknown: 0, margin: 78, feeLinks: null });
  assert.deepEqual(s.total, { supplier: null, count: 5, claim: 152, claimUnknown: 2, pay: 62, payUnknown: 2, margin: 78, feeLinks: null });
  assert.equal(s.amountConfirmed, 2);
  assert.equal(s.needsAttention, 3);
  assert.equal(s.suppliers[2].claim, null);
  assert.equal(s.suppliers[2].margin, null);
});

test('확정 금액과 업무 확인은 별개이며 보류·인도 전도 저장액을 보존한다', () => {
  const r = row({ billHold: true, delivered: false });
  const before = structuredClone(r);
  const s = settlementSummary([r], '', NOW);
  assert.equal(s.amountConfirmed, 1);
  assert.equal(s.needsAttention, 1);
  assert.deepEqual(s.reasons, [{ label: '보류', count: 1 }, { label: '인도', count: 1 }]);
  assert.equal(s.total.margin, 78);
  assert.deepEqual(r, before);
});

test('원 미만은 합산 전에 각 줄에서 버리고 확정 0은 CSV 숫자로 남긴다', () => {
  const s = settlementSummary([row({ claimWritten: 1.9, payWritten: 0 }), row({ claimWritten: 1.9, payWritten: 0 })], '', NOW);
  assert.equal(s.total.claim, 2);
  assert.equal(s.total.pay, 0);
  assert.ok(settlementSummaryCsv(s).endsWith('"합계",2,2,0,0,0,2,"가격행 검증 미실행"\r\n'));
});

test('기존 adapter가 미확정으로 분류한 미발행 0을 다시 0원으로 만들지 않는다', () => {
  const s = settlementSummary([row({ claimWritten: 0, billed: false })], '', NOW);
  assert.equal(s.total.claim, null);
  assert.equal(s.total.claimUnknown, 1);
  assert.equal(s.amountConfirmed, 0);
});

test('음수 환수는 원금과 상쇄되며 원 미만은 부호 대칭으로 버린다', () => {
  const s = settlementSummary([row({ claimWritten: 137.9, payWritten: 41.9 }), row({ claimWritten: -137.9, payWritten: -41.9 })], '', NOW);
  assert.equal(s.total.claim, 0);
  assert.equal(s.total.pay, 0);
  assert.equal(s.total.margin, 0);
  assert.equal(s.amountConfirmed, 2);
  assert.equal(s.total.claimUnknown, 0);
});

test('VAT 포함 저장액은 기존 원단위 함수로 줄마다 공급가 환산한다', () => {
  const s = settlementSummary([row({ vatIncluded: true, claimWritten: 121.9, payWritten: 55.9 }),
    row({ vatIncluded: true, claimWritten: -11.9, payWritten: -22.9 })], '', NOW);
  assert.equal(s.total.claim, 100);
  assert.equal(s.total.pay, 30);
  assert.equal(s.total.margin, 70);
});

test('저장 금액만 집계하며 요율·비율·프로모션·가감은 재계산하지 않는다', () => {
  const s = settlementSummary([row({ settleRatio: 0, claimAdjust: 97, payAdjust: 31, claimIncentive: 77, payIncentive: 22, billHold: true })], '', NOW);
  assert.equal(s.total.claim, 123);
  assert.equal(s.total.pay, 45);
  assert.equal(s.amountConfirmed, 1);
  assert.ok(s.reasons.some(r => r.label === '보류' && r.count === 1));
});

test('최신 청구월 기본 선택, 저장월 우선, 예정월과 청구월 미정 선택', () => {
  const rows = [row(), row({ billMonth: '2030-04' }), row({ billMonth: '', deliveredAt: '2030-01-01' }),
    row({ billMonth: '', delivered: false }), row({ billMonth: '2030-03', delivered: false })];
  const s = settlementSummary(rows, '', NOW);
  assert.equal(s.month, '2030-04');
  assert.deepEqual(s.months, ['2030-04', '2030-03', '2030-02', '2030-01', NO_MONTH]);
  assert.equal(settlementSummary(rows, '2030-03', NOW).total.count, 1);
  assert.equal(settlementSummary(rows, NO_MONTH, NOW).total.count, 1);
  assert.ok(settlementSummary(rows, NO_MONTH, NOW).reasons.some(r => r.label === NO_MONTH && r.count === 1));
});

test('이유별 건수는 기존 막힘 문구를 재사용하고 한 건의 같은 이유는 한 번만 센다', () => {
  const a = row({ delivered: false, billHold: true, claimWritten: null, payWritten: null });
  const b = row({ paper: false, delivered: false, claimWritten: null });
  const s = settlementSummary([a, b], '', NOW);
  const reasons = Object.fromEntries(s.reasons.map(r => [r.label, r.count]));
  assert.equal(s.needsAttention, 2);
  assert.equal(reasons[adminBlockLabel('청구금액 모름')], 2);
  assert.equal(reasons[adminBlockLabel('지급금액 모름')], 1);
  assert.equal(reasons[adminBlockLabel(blockOf(b)!)], 1);
  assert.equal(reasons['인도'], 2);
  assert.equal(reasons['보류'], 1);
});

test('취소·계약취소·정산제외는 제외하고 공급사 미정과 비정상 숫자는 숨기지 않는다', () => {
  const s = settlementSummary([row({ cancelled: true }), row({ contractCancelledAt: 1 }), row({ settleExclude: true }),
    { ...row({ supplier: null }), money: { ...row().money, claim: NaN, pay: Infinity } }], '', NOW);
  assert.equal(s.total.count, 1);
  assert.equal(s.total.claimUnknown, 1);
  assert.equal(s.total.payUnknown, 1);
  assert.equal(s.total.claim, null);
  assert.equal(s.suppliers[0].supplier, null);
});

test('빈 월은 임의의 다른 월로 바꾸지 않고 빈 합계를 반환한다', () => {
  const s = settlementSummary([row()], '2030-09', NOW);
  assert.equal(s.month, '2030-09');
  assert.equal(s.total.count, 0);
  assert.equal(s.total.claim, null);
  assert.equal(s.total.margin, null);
  assert.deepEqual(s.reasons, []);
  assert.equal(settlementSummary([], '', NOW).month, NO_MONTH);
});

test('유효하지 않은 저장 청구월은 도메인의 달력 검사로 미정에 모은다', () => {
  const s = settlementSummary([row({ billMonth: '2030-13' })], '', NOW);
  assert.equal(s.month, NO_MONTH);
  assert.equal(s.total.count, 1);
  assert.ok(s.reasons.some(r => r.label === NO_MONTH));
});

test('CSV는 UTF-8 BOM·한국어 8열·합계이며 쉼표 없는 숫자와 빈 금액을 보존한다', () => {
  const s = settlementSummary([row({ claimWritten: 12345, payWritten: -23 }),
    row({ supplier: '예시공급사B', claimWritten: null, payWritten: null })], '', NOW);
  const csv = settlementSummaryCsv(s);
  assert.equal(Buffer.from(csv).subarray(0, 3).toString('hex'), 'efbbbf');
  assert.equal(csv.slice(1).split('\r\n')[0], SETTLEMENT_SUMMARY_HEADERS.map(h => `"${h}"`).join(','));
  assert.ok(csv.includes('"예시공급사A",1,12345,0,-23,0,12368,"가격행 검증 미실행"\r\n'));
  assert.ok(csv.includes('"예시공급사B",1,,1,,1,,"가격행 검증 미실행"\r\n'));
  assert.ok(csv.endsWith('"합계",2,12345,1,-23,1,12368,"가격행 검증 미실행"\r\n'));
  assert.ok(!/example-row|차량번호|고객명|시트|청구서/.test(csv));
});

function linkRow(id: string, over: Record<string, unknown> = {}) {
  return { ...row({ supplierCode: 'EXAMPLE-A', term: 12, rent: 17, deposit: null, ...over }), id };
}
function linked(key: string, claim = 123, pay = 45): ContractFeeLinkResult {
  const fee = (amount: number) => ({ status: 'CONFIRMED' as const, state: amount === 0 ? 'ZERO' : 'KNOWN', amount: { amount } });
  return { key, status: 'LINKED', fees: { termKey: 'example-term', termMonths: 12,
    supplierBillingFee: fee(claim), channelPayoutFee: fee(pay) } };
}

test('가격행 요청은 500건 분할, key=접수 code, 공백 제거·무보증 0·모르는 보증금 생략', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => linkRow(`example-${i}`));
  rows[0] = linkRow('example-0', { plate: ' EX AMPLE ', deposit: 0 });
  const before = structuredClone(rows);
  const batches: ContractFeeLinkItem[][] = [];
  const read = await readContractFeeLinks(rows, { async contractFeeLinks(items) {
    batches.push([...items]); return items.map(item => linked(item.key));
  } });
  assert.equal(read.status, 'READY');
  assert.deepEqual(batches.map(b => b.length), [500, 500, 1]);
  assert.deepEqual(batches[0][0], { key: 'example-0', plate: 'EXAMPLE', supplierId: 'EXAMPLE-A', termMonths: 12, monthlyRent: 17, deposit: 0 });
  assert.equal('deposit' in batches[0][1], false);
  assert.deepEqual(rows, before);
});

test('차량번호·공급사 코드 없는 줄과 자리표시는 호출하지 않고 각각 이유로 센다', async () => {
  const rows = [linkRow('a', { plate: null }), linkRow('b', { plate: ' 신 차 ' }),
    linkRow('c', { plate: '미정' }), linkRow('d', { supplierCode: null }),
    linkRow('e', { plate: '', supplierCode: '' })];
  const read = await readContractFeeLinks(rows, { async contractFeeLinks() { assert.fail('호출 금지'); } });
  const s = settlementSummary(rows, '', NOW, read);
  assert.equal(s.total.feeLinks?.needsAttention, 5);
  assert.deepEqual(Object.fromEntries(s.feeLinkReasons.map(r => [r.label, r.count])), { '공급사 코드 없음': 2, '차량번호 없음': 4 });
});

test('유효하지 않은 입력·중복 key는 배치에서 제외하여 정상 줄의 조회를 보존한다', async () => {
  const rows = [linkRow('same'), linkRow('same'), linkRow('term', { term: 121 }),
    linkRow('fraction', { term: 1.5 }), linkRow('supplier', { supplierCode: '한글 코드' }),
    linkRow('rent', { rent: null }), linkRow('deposit', { deposit: -1 }),
    linkRow('x'.repeat(121)), linkRow(''), linkRow('valid')];
  const read = await readContractFeeLinks(rows, { async contractFeeLinks(items) {
    assert.deepEqual(items.map(i => i.key), ['valid']); return items.map(i => linked(i.key));
  } });
  const s = settlementSummary(rows, '', NOW, read);
  assert.equal(s.total.feeLinks?.linked, 1);
  assert.equal(s.total.feeLinks?.needsAttention, 9);
});

test('표시 월만 요청하며 취소·계약취소·제외 줄은 요청에서도 제외한다', async () => {
  const rows = [linkRow('a'), linkRow('b', { billMonth: '2030-03' }), linkRow('c', { cancelled: true }),
    linkRow('d', { contractCancelledAt: 1 }), linkRow('e', { settleExclude: true }),
    linkRow('f', { billMonth: '', delivered: false })];
  const selected = settlementSummary(rows, '', NOW);
  await readContractFeeLinks(settlementSummaryRows(rows, selected.month, NOW), { async contractFeeLinks(items) {
    assert.deepEqual(items.map(i => i.key), ['b']); return items.map(i => linked(i.key));
  } });
  assert.deepEqual(settlementSummaryRows(rows, NO_MONTH, NOW).map(r => r.id), ['f']);
  assert.equal(settlementSummaryRows(rows, '2031-01', NOW).length, 0);
});

test('LINKED 일치·차이와 원 미만 버림, 공급사별 건수만 집계하고 접수·합계는 보존한다', async () => {
  const rows = [linkRow('a'), linkRow('b', { supplier: '예시공급사B' }),
    linkRow('c', { claimWritten: 0, payWritten: 0 }), linkRow('d', { vatIncluded: true, claimWritten: 121, payWritten: 55 })];
  const before = structuredClone(rows);
  const read = await readContractFeeLinks(rows, { async contractFeeLinks() {
    return [linked('d', 110.9, 50.9), linked('c', 0, 0), linked('b', 7, 45), linked('a', 123.9, 45.9)];
  } });
  const s = settlementSummary(rows, '', NOW, read);
  assert.deepEqual(s.total.feeLinks, { linked: 4, needsAttention: 1, matched: 3, different: 1 });
  assert.equal(s.suppliers[0].feeLinks?.matched, 3);
  assert.equal(s.suppliers[1].feeLinks?.different, 1);
  const original = settlementSummary(rows, '', NOW);
  assert.deepEqual({ ...s.total, feeLinks: null }, original.total);
  assert.deepEqual(rows, before);
  const csv = settlementSummaryCsv(s);
  assert.ok(csv.includes('이어 붙음 4 · 확인 필요 1 · 일치 3 · 차이 1'));
  assert.ok(!/EXAMPLE|example-term|supplierBillingFee|channelPayoutFee/.test(csv));
});

for (const failure of CONTRACT_FEE_LINK_FAILURES) {
  test(`FAILED ${failure} 한국어 건수; 조건 불일치에 딸린 확정 금액도 비교하지 않는다`, async () => {
    const rows = [linkRow('a')];
    const read = await readContractFeeLinks(rows, { async contractFeeLinks() {
      return [{ ...linked('a'), status: 'FAILED', failure }];
    } });
    const s = settlementSummary(rows, '', NOW, read);
    assert.deepEqual(s.total.feeLinks, { linked: 0, needsAttention: 1, matched: 0, different: 0 });
    assert.deepEqual(s.feeLinkReasons, [{ label: CONTRACT_FEE_REASON_LABELS[failure], count: 1 }]);
  });
}

test('FEE_UNCONFIRMED와 미확정 금액은 일치로 추정하지 않는다', async () => {
  const rows = [linkRow('a'), linkRow('b'), linkRow('c', { payWritten: null }), linkRow('d')];
  const read = await readContractFeeLinks(rows, { async contractFeeLinks() {
    const b = linked('b');
    b.fees!.channelPayoutFee = { status: 'UNCONFIRMED', state: 'UNKNOWN', amount: { amount: 45 } };
    return [{ ...linked('a'), status: 'FEE_UNCONFIRMED' }, b, linked('c'), { key: 'd', status: 'LINKED' }];
  } });
  const s = settlementSummary(rows, '', NOW, read);
  assert.deepEqual(s.total.feeLinks, { linked: 3, needsAttention: 4, matched: 0, different: 0 });
  assert.equal(s.feeLinkReasons.find(r => r.label === '가격행 수수료 미확정')?.count, 3);
  assert.equal(s.feeLinkReasons.find(r => r.label === '접수 수수료 미확정')?.count, 1);
});

for (const code of ['401', '403', '503', 'TIMEOUT', 'UNAVAILABLE']) {
  test(`호출 실패 ${code}는 검증 불가만 표시하고 기존 정산 합계·CSV 유지`, async () => {
    const rows = [linkRow('a')];
    const read = await readContractFeeLinks(rows, { async contractFeeLinks() {
      if (code === 'TIMEOUT') throw new DOMException('비공개 오류 원문', 'TimeoutError');
      throw new Error(code === 'UNAVAILABLE' ? '비공개 오류 원문' : `FREEPASS_DATA_HTTP_${code}`);
    } });
    const s = settlementSummary(rows, '', NOW, read);
    assert.equal(s.total.claim, 123);
    assert.equal(s.total.pay, 45);
    assert.equal(feeLinkText(s.total.feeLinks), `가격행 검증 불가 · ${code}`);
    assert.ok(settlementSummaryCsv(s).includes(`가격행 검증 불가 · ${code}`));
    assert.ok(!settlementSummaryCsv(s).includes('비공개 오류 원문'));
    assert.deepEqual(s.feeLinkReasons, []);
  });
}

test('뒤 배치 실패는 앞 배치 성공을 전체 성공으로 표시하지 않는다', async () => {
  const rows = Array.from({ length: 501 }, (_, i) => linkRow(`example-${i}`));
  let calls = 0;
  const read = await readContractFeeLinks(rows, { async contractFeeLinks(items) {
    if (++calls === 2) throw new Error('FREEPASS_DATA_HTTP_503');
    return items.map(i => linked(i.key));
  } });
  assert.deepEqual(read, { status: 'UNAVAILABLE', code: '503' });
});

test('누락·중복·요청 외 응답 key는 잘못된 일치로 집계하지 않는다', async () => {
  for (const response of [[], [linked('a'), linked('a')], [linked('a'), linked('unknown')]]) {
    const read = await readContractFeeLinks([linkRow('a'), linkRow('b')], {
      async contractFeeLinks() { return response; },
    });
    assert.deepEqual(read, { status: 'UNAVAILABLE', code: 'INVALID_RESPONSE' });
  }
});

test('빈 월은 설정·토큰·실제 클라이언트 호출 없이 건수 0', async () => {
  const read = await readContractFeeLinks([], { async contractFeeLinks() { assert.fail('호출 금지'); } });
  const s = settlementSummary([], '', NOW, read);
  assert.deepEqual(s.total.feeLinks, { linked: 0, needsAttention: 0, matched: 0, different: 0 });
  assert.deepEqual(s.feeLinkReasons, []);
});

test('CSV 문자열의 쉼표·줄바꿈·따옴표 및 수식 시작문자를 안전하게 출력한다', () => {
  const s = settlementSummary([row()], '', NOW);
  s.suppliers[0].supplier = '=예시공급사A,"\n';
  assert.ok(settlementSummaryCsv(s).includes('"\'=예시공급사A,""\n"'));
  s.suppliers[0].supplier = '  @예시공급사B';
  assert.ok(settlementSummaryCsv(s).includes('"\'  @예시공급사B"'));
});
