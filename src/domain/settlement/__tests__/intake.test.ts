import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { intakeCode, intakeKey, settlementCode, settlementKey, eventDocId } from '../code.js';
import { intakeRecord, progressPatch, validateIntake, type IntakeInput } from '../intake.js';
import { claimLedger, ledgerMonths, payLedger } from '../ledgers.js';
import { billingMonth, bucketOf, paidRoundsOf, stageOf } from '../stage.js';
import { claimAmountOf, payAmountOf } from '../money.js';
import { blockOf, intakeTaskOf } from '../types.js';
import { toSettlementRow } from '../../../adapters/erp5/to-settlement.js';

const base: IntakeInput = {
  receivedAt: '2026-09-18', plate: '12가 3456', model: '싼타페', supplier: '손오공', supplierCode: 'RP001',
  customer: '홍길동', channel: '프리패스', channelCode: 'SP001', agent: '김영업', agentCode: 'A01',
  product: '장기렌트', rentKind: '재렌트', contractType: '전자약정',
  term: 36, rent: 700000, deposit: 0, price: null, payKind: '일시납',
  paper: false, delivered: false, deliveredAt: '', note: '',
};

describe('★코드 — 같은 차번+접수일이면 어디서 만들든 같은 코드 (병행 입력에서 두 줄이 안 선다)', () => {
  it('띄어쓰기가 달라도 같은 열쇠 · 같은 코드', () => {
    assert.equal(settlementKey('12가 3456', '2026-09-18'), settlementKey('12가3456', '2026-09-18'));
    assert.equal(settlementCode('12가 3456', '2026-09-18'), settlementCode('12가3456', '2026-09-18'));
  });
  it('ERP5 규격 stl_ + 10자', () => assert.match(settlementCode('12가3456', '2026-09-18'), /^stl_[2-9a-hj-km-np-z]{10}$/));
  it('차량번호 접수는 새 intakeCode도 기존 settlementCode와 같다', () =>
    assert.equal(intakeCode('12가3456', '', '2026-09-18'), settlementCode('12가3456', '2026-09-18')));
  it('차량번호 없는 상품접수는 Product ID + 접수일로 안정적인 코드를 만든다', () => {
    assert.equal(intakeCode('', 'P-1', '2026-09-18'), intakeCode('', 'P-1', '2026-09-18'));
    assert.notEqual(intakeCode('', 'P-1', '2026-09-18'), intakeCode('', 'P-2', '2026-09-18'));
    assert.equal(intakeKey('', 'P-1', '2026-09-18'), 'product:P-1|2026-09-18');
  });
  it('차량번호 없는 직접접수는 Request ID로 서로 다른 줄을 만든다', () => {
    const a = intakeCode('', '', '2026-09-18', 'req-a');
    const a2 = intakeCode('', '', '2026-09-18', 'req-a');
    const b = intakeCode('', '', '2026-09-18', 'req-b');
    assert.equal(a, a2);
    assert.notEqual(a, b);
    assert.equal(intakeKey('', '', '2026-09-18', 'req-a'), 'request:req-a|2026-09-18');
  });
  it('request identity는 나중에 차량번호가 생겨도 같은 identity를 유지한다', () => {
    assert.equal(
      intakeKey('', '', '2026-09-18', 'req-a', 'request'),
      intakeKey('12가3456', '', '2026-09-18', 'req-a', 'request'),
    );
  });
  it('접수일이 다르면 다른 줄 (재계약)', () =>
    assert.notEqual(settlementCode('316라1593', '2026-08-06'), settlementCode('316라1593', '2026-08-13')));
  it('이력 문서 id 는 ERP5 실측 꼴 — 차번_접수일', () => assert.equal(eventDocId('99시험0001', '2026-08-26'), '99시험0001_2026-08-26'));
});

describe('validateIntake — 최초 접수 필수값', () => {
  it('다 있으면 통과', () => assert.deepEqual(validateIntake(base, '2026-09-18'), []));
  it('차번 · 고객 · 채널 · 담당 · 공급사가 비면 이름을 댄다', () => {
    const e = validateIntake({ ...base, plate: '', customer: ' ', channel: '', agent: '', supplier: '' }, '2026-09-18');
    assert.equal(e.length, 5);
  });
  it('차량번호 없는 상품접수는 Product ID가 있으면 받는다', () => {
    const e = validateIntake({ ...base, plate: '', sourceProductId: 'P-NEW' }, '2026-09-18');
    assert.equal(e.some((x) => x.includes('차량번호')), false);
  });
  it('직접 신차 견적/발주는 차량번호 없이도 요청 ID로 접수한다', () => {
    for (const product of ['견적출고', '신차발주']) {
      const e = validateIntake({
        ...base, plate: '', sourceProductId: undefined, intakeRequestId: 'req-1234567890abcdef',
        product, rentKind: '신차렌트',
      }, '2026-09-18');
      assert.equal(e.some((x) => x.includes('차량번호')), false, product);
      assert.equal(e.some((x) => x.includes('요청 ID')), false, product);
    }
  });
  it('차량번호 없는 직접 신차 견적/발주는 요청 ID가 없으면 막는다', () => {
    assert.match(validateIntake({
      ...base, plate: '', sourceProductId: undefined, intakeRequestId: undefined, product: '신차발주', rentKind: '신차렌트',
    }, '2026-09-18').join(), /요청 ID/);
  });
  it('그 밖 직접접수는 차량번호가 없으면 막는다', () => {
    assert.match(validateIntake({
      ...base, plate: '', sourceProductId: undefined, intakeRequestId: 'req-1234567890abcdef', product: '장기렌트',
    }, '2026-09-18').join(), /차량번호/);
  });
  it('직접 신차 견적/발주는 렌트구분 신차렌트만 받는다', () => {
    const e = validateIntake({
      ...base, plate: '', sourceProductId: undefined, intakeRequestId: 'req-1234567890abcdef',
      product: '견적출고', rentKind: '재렌트',
    }, '2026-09-18');
    assert.match(e.join(), /렌트구분은 신차렌트/);
  });
  it('차량번호 없는 상태에서는 최초 접수에서도 인도완료를 못 건다', () => {
    const e = validateIntake({
      ...base, plate: '', sourceProductId: undefined, intakeRequestId: 'req-1234567890abcdef',
      product: '신차발주', rentKind: '신차렌트', delivered: true, deliveredAt: '2026-09-18',
    }, '2026-09-18');
    assert.match(e.join(), /차량번호를 배정한 뒤/);
  });
  it('★접수일이 오늘 뒤면 안 받는다 (원장에 2026-12-12 가 한 줄 들어가 있다)', () =>
    assert.match(validateIntake({ ...base, receivedAt: '2026-12-12' }, '2026-09-18').join(), /오늘/));
  it('★인도는 계약서와 독립 사실이고, 인도일만 함께 요구한다', () => {
    const e = validateIntake({ ...base, paper: false, delivered: true }, '2026-09-18').join();
    assert.doesNotMatch(e, /계약서/);
    assert.match(e, /인도일/);
    assert.equal(validateIntake({ ...base, paper: false, delivered: true, deliveredAt: '2026-09-18' }, '2026-09-18').some((x) => x.includes('계약서')), false);
  });
});

describe('intakeRecord — 기존 461줄과 같은 꼴', () => {
  const r = intakeRecord(base, 1_790_000_000_000);
  it('code == 문서 id 규칙 · 차번은 띄어쓰기 없이', () => {
    assert.equal(r.code, settlementCode('12가3456', '2026-09-18'));
    assert.equal(r.plate, '12가3456');
  });
  it('단계는 접수에서 시작 · 청구/지급 0 은 「모름」 으로 읽힌다', () => {
    assert.equal(r.claimStage, '접수'); assert.equal(r.payStage, '접수');
    const { row } = toSettlementRow(r, String(r.code));
    assert.equal(row.money.claim, null);
  });
  it('인도 전이면 인도일을 안 박는다', () => assert.equal(r.deliveredAt, ''));
  it('차량번호 없는 직접 신차발주는 request identity를 원장에 보존한다', () => {
    const raw = intakeRecord({
      ...base,
      plate: '',
      product: '신차발주',
      intakeRequestId: 'req-direct-newcar',
    }, 1_790_000_000_000);
    assert.equal(raw.intakeRequestId, 'req-direct-newcar');
    assert.equal(raw.intakeIdentityMode, 'request');
    assert.equal(raw.code, intakeCode('', '', '2026-09-18', 'req-direct-newcar', 'request'));
  });
  it('미확인 계약조건은 0으로 바꾸지 않는다', () => {
    const raw = intakeRecord({ ...base, term: null, rent: null, deposit: null, price: null }, 1_790_000_000_000);
    assert.equal(raw.term, null);
    assert.equal(raw.rent, null);
    assert.equal(raw.deposit, null);
    assert.equal(raw.price, null);
    const { row } = toSettlementRow(raw, String(raw.code));
    assert.equal(row.term, null);
    assert.equal(row.rent, null);
    assert.equal(row.deposit, null);
    assert.equal(row.price, null);
  });
  it('상품접수 provenance를 원장에 보존하고 다시 읽는다', () => {
    const raw = intakeRecord({
      ...base,
      sourceProductId: 'P-1',
      sourceProductVersion: 7,
      sourceOfferId: 'O-36',
      sourceSnapshotId: 'erp5-20260921',
    }, 1_790_000_000_000);
    assert.equal(raw.sourceProductId, 'P-1');
    assert.equal(raw.sourceProductVersion, 7);
    assert.equal(raw.sourceOfferId, 'O-36');
    const { row } = toSettlementRow(raw, String(raw.code));
    assert.deepEqual(row.catalogRef, {
      productId: 'P-1',
      productVersion: 7,
      offerId: 'O-36',
      sourceSnapshotId: 'erp5-20260921',
    });
  });

  it('상품접수 immutable snapshot은 Offer 조건과 적용 정책을 그대로 보존한다', () => {
    const snapshot = {
      capturedAt: '2026-09-21T00:00:00.000Z',
      product: {
        id: 'P-1', version: 7, sourceSnapshotId: 'erp5-20260921',
        supplierId: 'SUP-1', supplierName: '공급사A', productKind: '중고렌트',
        vehicle: {
          nodeId: 'trim-1', originId: 'KR', manufacturerId: 'HYUNDAI',
          modelId: 'SANTAFE', subModelId: 'MX5', trimId: 'CALLI', matchLevel: 'TRIM',
        },
        registration: { vehicleNumber: null, vin: null, firstRegistrationDate: null },
      },
      offer: {
        id: 'O-36', termMonths: 36, monthlyRent: 700000,
        deposit: null, prepayment: 1000000, annualMileageKm: 20000,
        policyValues: [{ policyId: 'min-age', type: 'NUMBER' as const, value: 21 }],
      },
    };
    const raw = intakeRecord({
      ...base,
      sourceProductId: 'P-1',
      sourceProductVersion: 7,
      sourceOfferId: 'O-36',
      sourceSnapshotId: 'erp5-20260921',
      catalogSnapshot: snapshot,
    }, 1_790_000_000_000);
    const { row } = toSettlementRow(raw, String(raw.code));
    assert.deepEqual(row.catalogSnapshot, snapshot);
    assert.equal(row.catalogSnapshot?.offer.annualMileageKm, 20000);
    assert.equal(row.catalogSnapshot?.offer.prepayment, 1000000);
    assert.equal(row.catalogSnapshot?.offer.policyValues[0]?.policyId, 'min-age');
  });
});

describe('progressPatch — 계약서 · 인도 · 취소', () => {
  it('계약서 켜기 → 칸 하나 · 이력 하나', () => {
    const r = progressPatch({ paper: false }, { kind: 'paper', on: true });
    assert.ok(r.ok); assert.deepEqual(r.ok && r.patch, { paper: true }); assert.equal(r.ok && r.events.length, 1);
  });
  it('차량번호를 나중에 배정할 수 있다', () => {
    const r = progressPatch({ plate: '', cancelled: false }, { kind: 'plate', plate: '12가 3456' });
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.patch, { plate: '12가3456' });
    assert.equal(r.ok && r.events[0]?.field, '차량번호');
  });
  it('이미 그 값이면 안 쓴다', () => {
    const r = progressPatch({ paper: true }, { kind: 'paper', on: true });
    assert.ok(r.ok && r.events.length === 0);
  });
  it('계약서가 없어도 실제 인도 사실은 기록한다', () => {
    const r = progressPatch({ paper: false, plate: '12가3456', delivered: false }, { kind: 'delivered', on: true, deliveredAt: '2026-09-18' });
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.patch, { delivered: true, deliveredAt: '2026-09-18' });
  });
  it('차량번호 없으면 인도 완료를 막는다', () =>
    assert.match(String((progressPatch({ paper: true, plate: '' }, { kind: 'delivered', on: true, deliveredAt: '2026-09-18' }) as { error?: string }).error), /차량번호/));
  it('인도는 날짜 없이 못 켠다', () => assert.equal(progressPatch({ paper: true, plate: '12가3456' }, { kind: 'delivered', on: true }).ok, false));
  it('인도 → 인도완료·인도일 이력 (erp4 이력과 같은 칸 이름)', () => {
    const r = progressPatch({ paper: true, plate: '12가3456', delivered: false, deliveredAt: '' }, { kind: 'delivered', on: true, deliveredAt: '2026-09-18' });
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.events.map((e) => e.field), ['인도완료', '인도일']);
  });
  it('★정산 전 인도를 되돌려도 인도일은 안 지운다', () => {
    const r = progressPatch({ delivered: true, deliveredAt: '2026-09-01', claimStage: '접수', payStage: '접수' }, { kind: 'delivered', on: false });
    assert.deepEqual(r.ok && r.patch, { delivered: false });
  });
  it('인도/정산 시작 뒤 차량번호·계약서·인도일·인도완료 핵심 사실을 되돌리지 않는다', () => {
    assert.equal(progressPatch({ delivered: true, plate: '12가3456' }, { kind: 'plate', plate: '34나5678' }).ok, false);
    const paperCorrection = progressPatch({ delivered: true, paper: true, claimStage: '접수', payStage: '접수' }, { kind: 'paper', on: false });
    assert.ok(paperCorrection.ok);
    assert.equal(progressPatch({ delivered: true, paper: true, billed: true, claimStage: '청구' }, { kind: 'paper', on: false }).ok, false);
    assert.equal(progressPatch({ delivered: true, deliveredAt: '2026-09-01', billed: true, claimStage: '청구', payStage: '통보', paper: true, plate: '12가3456' }, { kind: 'delivered', on: true, deliveredAt: '2026-09-02' }).ok, false);
    assert.equal(progressPatch({ delivered: true, billed: true, claimStage: '청구', payStage: '통보' }, { kind: 'delivered', on: false }).ok, false);
  });
  it('취소는 사유가 있어야 · 사유는 메모에 덧붙인다', () => {
    assert.equal(progressPatch({}, { kind: 'cancelled', on: true }).ok, false);
    const r = progressPatch({ note: '원래 메모', claimStage: '접수', payStage: '접수' }, { kind: 'cancelled', on: true, reason: '고객 변심' });
    assert.ok(r.ok);
    assert.equal(r.ok && r.patch.note, '원래 메모 / [취소] 고객 변심');
  });
  it('청구/통보 등 정산이 시작된 뒤에는 일반 취소하지 않는다', () => {
    assert.equal(progressPatch({ billed: true, claimStage: '청구', payStage: '통보' }, { kind: 'cancelled', on: true, reason: '중도 해지' }).ok, false);
    assert.equal(progressPatch({ claimStage: '확인', payStage: '확인' }, { kind: 'cancelled', on: true, reason: '중도 해지' }).ok, false);
  });
  it('레거시 TRUE 꼴과 과거 정산 atom도 정산 시작으로 본다', () => {
    assert.equal(progressPatch({ collected: 1 }, { kind: 'cancelled', on: true, reason: 'x' }).ok, false);
    assert.equal(progressPatch({ paid: 'Y' }, { kind: 'cancelled', on: true, reason: 'x' }).ok, false);
    assert.equal(progressPatch({ supplierOk: '참' }, { kind: 'cancelled', on: true, reason: 'x' }).ok, false);
    assert.equal(progressPatch({ stage: '청구' }, { kind: 'cancelled', on: true, reason: 'x' }).ok, false);
    assert.equal(progressPatch({ settledAlready: 1 }, { kind: 'cancelled', on: true, reason: 'x' }).ok, false);
    assert.equal(progressPatch({ invoiceNoS: 'FP-S-202609-001' }, { kind: 'cancelled', on: true, reason: 'x' }).ok, false);
  });
  it('정산 흔적이 있는 취소 건은 취소를 풀어 원장에 재등장시키지 않는다', () => {
    assert.equal(progressPatch({ cancelled: true, billed: true }, { kind: 'cancelled', on: false }).ok, false);
    assert.equal(progressPatch({ cancelled: true, collected: 1 }, { kind: 'cancelled', on: false }).ok, false);
    const clean = progressPatch({ cancelled: true, claimStage: '접수', payStage: '접수' }, { kind: 'cancelled', on: false });
    assert.ok(clean.ok);
  });
  it('취소된 줄은 취소를 풀기 전에 못 고친다', () =>
    assert.equal(progressPatch({ cancelled: true }, { kind: 'paper', on: true }).ok, false));
});

const NOW = new Date(2026, 8, 18);   // 2026-09-18
const row = (o: Record<string, unknown>) => toSettlementRow({
  code: 'r', plate: '1가1', receivedAt: '2026-06-01', supplier: 'A', channel: 'X', delivered: true, deliveredAt: '2026-06-10',
  cancelled: false, billMonth: '', claimWritten: 1_000_000, payWritten: 800_000, payKind: '일시납', ...o,
}, 'r').row;

describe('다음 할 일 — 계약 → 차량 → 인도 순서', () => {
  it('신차처럼 차번이 없어도 계약서가 먼저다', () => {
    assert.equal(blockOf(row({ paper: false, plate: '', delivered: false, deliveredAt: '' })), '계약서');
  });
  it('계약 확인 뒤 차번, 차번 뒤 인도 순서다', () => {
    assert.equal(blockOf(row({ paper: true, plate: '', delivered: false, deliveredAt: '' })), '차량번호 없음');
    assert.equal(blockOf(row({ paper: true, plate: '12가3456', delivered: false, deliveredAt: '' })), '인도');
  });
});

describe('다음 할 일 — 정산대상별 축을 섞지 않는다', () => {
  it('영업-only는 공급사가 없어도 되고 영업채널/지급만 본다', () => {
    const salesOnly = row({
      settleTarget: '영업', supplier: '', channel: 'X', paper: true,
      payWritten: 800_000, paid: false,
    });
    assert.equal(blockOf(salesOnly), '지급');
    assert.equal(blockOf(row({ settleTarget: '영업', supplier: '', channel: '', paper: true, payWritten: 800_000 })), '영업채널 없음');
  });

  it('공급-only는 영업채널이 없어도 되고 청구/계산서/수금만 본다', () => {
    const supplyOnly = row({
      settleTarget: '공급', supplier: 'A', channel: '', paper: true,
      claimWritten: 1_000_000, billed: true, invoiceIssued: true, collected: false,
    });
    assert.equal(blockOf(supplyOnly), '수금');
  });

  it('양쪽은 공급 축을 끝낸 뒤 영업 축 누락을 드러낸다', () => {
    const both = row({
      settleTarget: '양쪽', supplier: 'A', channel: '', paper: true,
      claimWritten: 1_000_000, billed: true, invoiceIssued: true, collected: true,
      payWritten: 800_000, paid: false,
    });
    assert.equal(blockOf(both), '영업채널 없음');
  });
});

describe('접수 업무 필터 — blockOf와 같은 정본을 쓴다', () => {
  it('계약/차량/인도/정산/완료/취소를 한 번씩 분류한다', () => {
    assert.equal(intakeTaskOf(row({ paper: false, plate: '', delivered: false })), '계약');
    assert.equal(intakeTaskOf(row({ paper: true, plate: '', delivered: false })), '차량');
    assert.equal(intakeTaskOf(row({ paper: true, plate: '12가3456', delivered: false })), '인도');
    assert.equal(intakeTaskOf(row({ paper: true, plate: '12가3456', delivered: true, claimWritten: 1_000_000, billed: false })), '정산');
    assert.equal(intakeTaskOf(row({ paper: true, plate: '12가3456', delivered: true, billed: true, invoiceIssued: true, collected: true, paid: true })), '완료');
    assert.equal(intakeTaskOf(row({ cancelled: true })), '취소');
  });
});

describe('★완납·인도 기준 — 대표 「접수 -> 분납실적/완납실적 -> 완납인도기준으로 청구 및 지급」', () => {
  it('인도 전이면 청구월이 없다(아직) — 접수', () => {
    const r = row({ delivered: false, deliveredAt: '' });
    assert.equal(billingMonth(r, NOW), null);
    assert.equal(stageOf(r, NOW), '접수');
  });
  it('일시납은 인도월 · 완납실적', () => {
    const r = row({});
    assert.equal(billingMonth(r, NOW), '2026-06');
    assert.equal(stageOf(r, NOW), '완납실적');
  });
  it('분납은 인도일부터 — 1회차는 인도 때 · 완납월에 청구 (9월 인도분부터)', () => {
    const r = row({ payKind: '3회분납', receivedAt: '2026-09-01', deliveredAt: '2026-09-05' });
    assert.equal(billingMonth(r, NOW), '2026-11');           // 인도 9/5 + 2개월
    assert.equal(paidRoundsOf(r, NOW), 1);
    assert.equal(bucketOf(r, NOW), '당월접수');                // 당월 접수는 이달이 끝날 때까지 접수
    assert.equal(stageOf(r, new Date(2026, 9, 2)), '분납실적');
  });
  it('9월 전 인도분은 옛 규칙(인도월) 그대로 — 지난 달을 흔들지 않는다', () =>
    assert.equal(billingMonth(row({ payKind: '2회분납', deliveredAt: '2026-08-20' }), NOW), '2026-08'));
  it('박힌 청구월이 이긴다', () => assert.equal(billingMonth(row({ billMonth: '2026-07' }), NOW), '2026-07'));
  it('당월 접수 · 지난달 이전인데 인도 전이면 미완료', () => {
    assert.equal(bucketOf(row({ receivedAt: '2026-09-02', delivered: false, deliveredAt: '' }), NOW), '당월접수');
    assert.equal(bucketOf(row({ receivedAt: '2026-07-02', delivered: false, deliveredAt: '' }), NOW), '미완료');
  });
});

describe('★분납이 끊기면 — 받은 회차는 사람이 적는다', () => {
  const broken = { payKind: '2회분납', deliveredAt: '2026-07-01', paidRounds: 1 };
  it('적힌 회차가 있어야 끊겼다고 말한다 — 받은 만큼 비례 (133호1997 1,688,750 × 1/2)', () => {
    const r = row({ ...broken, claimWritten: 1_688_750 });
    assert.equal(billingMonth(r, NOW), '2026-07');          // 받은 1회차의 달
    assert.equal(claimAmountOf(r, NOW), 844_375);
  });
  it('안 적혔으면 기간 비례라 「받은 것」 — 전액', () =>
    assert.equal(claimAmountOf(row({ ...broken, paidRounds: null }), NOW), 1_000_000));
  it('★스타·아이카는 끊기면 지급 0', () => {
    assert.equal(payAmountOf(row({ ...broken, supplier: '아이카' }), NOW), 0);
    assert.equal(payAmountOf(row({ ...broken, supplier: '손오공' }), NOW), 400_000);
  });
});

describe('받은 회차 찍기', () => {
  it('분납·인도된 줄만 · 1~회차 수 · 정산 시작 뒤 변경 금지', () => {
    assert.equal(progressPatch({ payKind: '일시납', delivered: true }, { kind: 'paidRounds', rounds: 1 }).ok, false);
    assert.equal(progressPatch({ payKind: '2회분납', delivered: false }, { kind: 'paidRounds', rounds: 1 }).ok, false);
    assert.equal(progressPatch({ payKind: '2회분납', delivered: true }, { kind: 'paidRounds', rounds: 3 }).ok, false);
    const r = progressPatch({ payKind: '2회분납', delivered: true, claimStage: '접수', payStage: '접수' }, { kind: 'paidRounds', rounds: 1 });
    assert.deepEqual(r.ok && r.patch, { paidRounds: 1 });
    assert.equal(progressPatch({ payKind: '2회분납', delivered: true, claimStage: '청구', payStage: '통보', billed: true }, { kind: 'paidRounds', rounds: 1 }).ok, false);
  });
});

describe('청구목록 · 지급목록 — 완납·인도 기준 · 환수', () => {
  const mk = (o: Record<string, unknown>) => toSettlementRow({
    code: String(o.code), plate: '1가1', receivedAt: '2026-08-01', supplier: 'A', channel: 'X',
    paper: true, delivered: true, deliveredAt: '2026-08-03', cancelled: false, billMonth: '2026-08', claimWritten: 100, payWritten: 40, payStage: '접수',
    ...o,
  }, String(o.code)).row;
  const rows = [
    mk({ code: 'a' }),
    mk({ code: 'b', supplier: 'B', claimWritten: 0, billed: false }),           // 안 끝난 0 → 모름
    mk({ code: 'c', delivered: false, deliveredAt: '', billMonth: '' }),       // ★인도 전 → 안 선다
    mk({ code: 'd', cancelled: true }),
    mk({ code: 'e', settleExclude: true }),
    mk({ code: 'g', channel: 'Y', payStage: '통보', billed: true }),
    mk({ code: 'h', claimIncentive: 30, payIncentive: 20 }),
    mk({ code: 'i', settleTarget: '영업' }),
    mk({ code: 'j', billHold: true }),
    mk({ code: 'k', billMonth: '', deliveredAt: '2026-08-20' }),               // 박힌 달(8월)에 계산으로 오는 줄 → 청구월 미정
  ];
  const claw = [{ plate: '1가1', month: '2026-08', supplier: 'A', channel: 'X', supplierAmt: 50, agentAmt: 10, reason: '중도해지', at: '2026-08-20' }];
  it('계약서 또는 차량번호 없는 줄은 돈 원장에 안 선다', () => {
    const bad = [mk({ code: 'no-paper', paper: false }), mk({ code: 'no-plate', plate: '' })];
    assert.equal(claimLedger(bad, '2026-08', [], NOW).length, 0);
    assert.equal(payLedger(bad, '2026-08', [], NOW).length, 0);
  });
  it('인도 전 줄은 안 선다 · 취소·제외도 안 선다', () => {
    const a = claimLedger(rows, '2026-08', claw, NOW).find((g) => g.party === 'A')!;
    assert.deepEqual(a.rows.map((r) => r.id).sort(), ['a', 'g', 'h', 'j']);
  });
  it('★닫힌 달을 흔들지 않는다 — 계산으로 온 줄은 청구월 미정', () => {
    assert.ok(claimLedger(rows, '청구월 미정', [], NOW).some((g) => g.rows.some((r) => r.id === 'k')));
    assert.ok(ledgerMonths(rows, [], NOW).includes('청구월 미정'));
  });
  it('인센티브를 더한다 · 보류는 0 · 환수를 뺀다', () => {
    const a = claimLedger(rows, '2026-08', claw, NOW).find((g) => g.party === 'A')!;
    assert.equal(a.total, 100 + 100 + 130 + 0);
    assert.equal(a.net, 330 - 50);
  });
  it('★모르는 금액은 합에 안 넣고 따로 센다', () => {
    const b = claimLedger(rows, '2026-08', [], NOW).find((g) => g.party === 'B')!;
    assert.equal(b.total, 0); assert.equal(b.unknown, 1);
  });
  it('정산대상 「영업」 은 지급에만 선다', () => {
    assert.ok(!claimLedger(rows, '2026-08', [], NOW).some((g) => g.rows.some((r) => r.id === 'i')));
    assert.ok(payLedger(rows, '2026-08', claw, NOW).find((g) => g.party === 'X')!.rows.some((r) => r.id === 'i'));
  });
});
