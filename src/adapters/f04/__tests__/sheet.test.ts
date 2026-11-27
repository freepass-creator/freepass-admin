import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyInvoice } from '../../../domain/settlement/invoice-document.js';
import {
  billMonthOf, cellCheck, cellDate, cellNumber, f04SettlementField, findHeader, picker, serialToDate,
  F04_LEDGER_TABS, F04_LEDGER_MODE, intakeSourceRows, assertIntakeOnlySnapshot, assertIntakeHeaders, reconcileF04Intake, f04SyncInput, planF04IntakeSync,
} from '../sheet.js';

/* 값은 F04 시트 실측(2026-09-17)에서 그대로 딴 것이다. */

describe('누적 접수 원장', () => {
  const head = ['접수일', '차량번호', '고객명', '인도완료'];
  it('보관 탭은 읽지 않는다', () => assert.deepEqual(F04_LEDGER_TABS, ['접수']));
  it('템플릿 체크는 제외하되 원본 행 번호와 지원금/날짜 없는 환수는 보존한다', () => {
    const raw = [[], head, ['', '', '', false], ['2026-09-01', 'PLATE_A'],
      ['', '', '지원금'], ['', 'PLATE_B', '환수'], ['', '', '', true]];
    assert.deepEqual(intakeSourceRows(raw, 1).map((r) => r.sourceRow), [4, 5, 6]);
  });
  it('차량+접수일 중복은 조용히 합산하지 않는다', () => {
    assert.throws(() => intakeSourceRows([head, [46266, 'PLATE A'], ['2026-09-01', 'PLATEA']], 0), /중복/);
  });
  it('같은 차량 재접수 날짜는 별도 이력이다', () => {
    assert.equal(intakeSourceRows([head, ['2026-09-01', 'PLATE_A'], ['2026-09-02', 'PLATE_A']], 0).length, 2);
  });
});

describe('접수·서버 읽기 전용 대조', () => {
  it('전환 뒤 같은 번호의 다른 접수만 누락으로 남기고 보관 탭 고아를 찾는다', () => {
    const result = reconcileF04Intake([
      { plate: 'OLD', receivedAt: '2026-09-30', sourceRow: 10 },
      { plate: 'CAR X', receivedAt: '2026-10-01', sourceRow: 11 },
      { plate: 'CAR X', receivedAt: '2026-11-12', sourceRow: 12 },
      { plate: 'CAR INVALID', receivedAt: '2026-11-31', sourceRow: 13 },
      { plate: '', receivedAt: '2026-11-10', sourceRow: 14 },
    ], [
      { plate: 'CARX', receivedAt: '2026-10-01', fromSheet: '분납실적', f04ImportedAt: '2026-10-07T00:00:00Z' },
      { plate: 'LEGACY', receivedAt: '2026-12-12', fromSheet: '접수 + 완납실적 + 분납실적', sourceRow: 20 },
      { plate: 'ADMIN', receivedAt: '2026-10-07', fromSheet: 'Admin', f04ImportedAt: '잘못된 시각' },
    ], '2026-11-27');
    assert.deepEqual(result.adminOnlyInSheet, [12]);
    assert.deepEqual(result.sheetRowsMissingValidKey, [13, 14]);
    assert.deepEqual(result.legacyOrphans, [{ tab: '옛 통합 원장', day: '2026-12-12', sourceRow: 20 }]);
    assert.equal(result.latestSheetReceipt, '2026-11-12');
    assert.equal(result.latestServerReceipt, '2026-10-07');
    assert.equal(result.lastRecordedF04Import, '2026-10-07T00:00:00Z');
    assert.equal(result.serverFutureReceipts, 1);
    assert.doesNotMatch(JSON.stringify(result), /CARX|LEGACY/);
  });
});

describe('F04 한 방향 반영 계획', () => {
  const headers = ['차량번호', '접수일', '공급사', '고객명', '영업채널', '모델명',
    '비고', '청구액', '지급액', '청구', '공급사부가세', '청구금액'];
  const make = (overrides: unknown[] = []) => f04SyncInput(picker(headers), [
    'VEHICLE_A', '2026-11-05', '공급사 A', '시험 고객', '채널 A', '모델 A', '비고 A',
    100, 90, false, 10, 110,
  ].map((value, i) => overrides[i] ?? value), 42);
  const plan = (sources: ReturnType<typeof make>[], server: Parameters<typeof planF04IntakeSync>[1] = []) =>
    planF04IntakeSync(sources, server, '2026-11-27');
  const asExisting = (proposal: ReturnType<typeof plan>) => ({
    id: proposal.writes[0].id, updateTime: '2026-11-26T00:00:00.123456Z', data: proposal.writes[0].data,
  });


  const evidenceHeaders = [...headers, '청구상태', '청구 최종발송일', '청구 발송증빙',
    '청구년', '청구월', '인도완료', '인도일'];
  const withEvidence = (sourceRow: number, evidence: string, finalDay = '', status = '청구발송증빙확인',
    delivered = true, deliveredAt = '2026-10-20') =>
    f04SyncInput(picker(evidenceHeaders), [
      'TEST_' + sourceRow, '2026-10-01', '시험 공급사', '시험 고객', '시험 채널', '시험 모델', '',
      100, 90, false, 10, 110, status, finalDay, evidence, 2026, 10, delivered, deliveredAt,
    ], sourceRow);

  it('검증한 17개 행 모양을 모두 기청구 처리하고 새 청구서에서 제외한다', () => {
    const cases = [
      ...[493, 494, 498, 504, 508, 515, 531].map(row =>
        ({ row, date: '2026-11-02', source: withEvidence(row, '11-02 카톡 발송, 11-09 재확인') })),
      ...[496, 500, 503, 506, 514, 517, 518, 525].map(row =>
        ({ row, date: '2026-11-09', source: withEvidence(row, '11-02 메일 발송', '2026-11-09') })),
      ...[632, 633].map(row =>
        ({ row, date: '2026-11-05', source: withEvidence(row, '2026-10 청구서 발송 확인(11-05)') })),
    ];
    const result = plan(cases.map(test => test.source));
    assert.equal(result.writes.length, 17);
    for (const [index, test] of cases.entries()) {
      const write = result.writes[index];
      assert.equal(write.row, test.row);
      assert.equal(write.data.billed, true, String(test.row));
      assert.equal(write.data.billedAt, test.date, String(test.row));
      assert.equal(write.data.paid, false, String(test.row));
    }
    const rows = result.writes.map(write => ({
      supplier: '시험 공급사', billMonth: '2026-10', plate: 'TEST_' + write.row,
      receivedAt: '2026-10-01', delivered: true, claim: 100, billed: write.data.billed === true,
    }));
    const party = { name: '시험', bizNo: '' };
    const invoice = buildMonthlyInvoice({
      month: '2026-10', supplier: '시험 공급사',
      issuer: { ...party, bank: '', account: '', holder: '', manager: '', phone: '', email: '' },
      receiver: party,
      rows: [...rows, { ...rows[0], plate: 'TEST_NEW', billed: false }],
    });
    assert.equal(invoice.claimLineCount, 1);
    assert.equal(invoice.lines[0].plate, 'TEST_NEW');
  });

  it('발송 날짜가 없거나 여러 날짜가 모호하면 보류하고 미발행 상태의 메모로 기청구하지 않는다', () => {
    for (const evidence of ['파일 참조', '11-02 검토 및 11-05 확인', '11-31 카톡']) {
      const result = plan([withEvidence(1, evidence)]);
      assert.equal(result.writes.length, 0);
      assert.deepEqual(result.entries[0].reasons, ['기청구 발송일 확인 필요']);
    }
    const result = plan([withEvidence(2, '11-05 검토 메모', '', '청구대상·이력미확인')]);
    assert.equal(result.writes[0].data.billed, false);
    assert.equal(result.writes[0].data.billedAt, '');
    const fullDate = plan([withEvidence(3, '2026-11-05 이메일', '', '청구서 발송 완료')]);
    assert.equal(fullDate.writes[0].data.billedAt, '2026-11-05');
  });

  it('미인도 일곱 행의 예정일과 문자는 비우고 산정 조건은 공란으로 둔다', () => {
    const examples = [576, 589, 594, 608, 610, 614, 617];
    const result = plan(examples.map(row => withEvidence(row, '', '', '', false,
      row === 576 ? '목요일입금' : '2026-11-25')));
    assert.equal(result.writes.length, 7);
    for (const op of result.writes) {
      assert.equal(op.data.delivered, false);
      assert.equal(op.data.deliveredAt, '');
      assert.equal(op.data.settleNote, '');
    }
    assert.equal(plan([make()]).writes[0].data.settleNote, '');
  });

  it('서버에 없는 접수를 추가하고 대외 계획에는 행 번호와 사유만 남긴다', () => {
    const result = plan([make()]);
    assert.equal(result.writes[0].data.claimWritten, 100);
    assert.equal(result.entries[0].action, '추가');
    assert.doesNotMatch(JSON.stringify(result.entries), /VEHICLE_A|시험 고객|비고 A/);
    assert.equal(plan([make()], [asExisting(result)]).writes.length, 0);
  });
  it('시트 관리값만 갱신하며 서버 직접 수정과 사용자 메모를 보존한다', () => {
    const current = asExisting(plan([make()]));
    current.data.note = '서버 메모';
    const changed = make([,,,,, '모델 B', '시트 메모']);
    const result = plan([changed], [current]);
    assert.deepEqual(result.entries[0].fields, ['model']);
    assert.equal(result.writes[0].data.note, undefined);
    assert.equal(result.writes[0].data.model, '모델 B');
    assert.notEqual(result.fingerprint, plan([make()], [current]).fingerprint);
    current.data.model = '서버 수정 모델';
    assert.equal(plan([changed], [current]).entries[0].action, '보류');
  });
  it('기청구·지급된 행의 금액을 바꾸지 않으며 신규 확정액이 불명확하면 보류한다', () => {
    const frozen = asExisting(plan([make()]));
    frozen.data.billed = true;
    frozen.data.paid = true;
    const next = make([,,,,, '모델 B',, 200, 190]);
    assert.equal(plan([next], [frozen]).entries[0].action, '보류');
    assert.equal(plan([make([,,,,,,,,, true, 90, 190])]).entries[0].action, '보류');
    assert.equal(plan([make([,,,,,,,,, true])]).writes[0].data.claimWritten, 100);
  });
  it('같은 날 중복 키 둘은 보류하고 서로 다른 계약번호는 결정 ID로 구분한다', () => {
    const source = make();
    const duplicate = { ...source, sourceRow: 43 };
    assert.deepEqual(plan([source, duplicate]).entries.map(row => row.action), ['보류', '보류']);
    const one = { ...source, contractNo: 'BOOK1234' };
    const two = { ...duplicate, contractNo: 'BOOK5678' };
    const both = plan([one, two]);
    assert.equal(both.writes.length, 2);
    assert.notEqual(both.writes[0].id, both.writes[1].id);
    assert.equal(both.writes[0].id, plan([{ ...one, sourceRow: 500 }]).writes[0].id);
    assert.notEqual(both.writes[0].id, plan([{ ...one, createdMarker: 'another-source' }]).writes[0].id);
    assert.equal(plan([one, two], both.writes.map(item => ({ id: item.id, updateTime: '', data: item.data }))).writes.length, 0);
  });
  it('서버에서 비슷한 날짜·영업자·공급사·금액을 찾아 새 키 복사를 보류한다', () => {
    const row = { ...make(), agent: '영업자' };
    const existing = asExisting(plan([row]));
    assert.match(plan([{ ...row, plate: 'EDITED', receivedAt: '2026-11-08' }], [existing]).entries[0].reasons[0], /키 변경/);
    assert.equal(plan([{ ...row, plate: 'NEW', receivedAt: '2026-11-09' }], [existing]).writes.length, 1);
  });
  it('취소 상태는 신규에만 복사하고 이미 확정된 서버 건에는 환수 표시만 남긴다', () => {
    const row = make();
    const canceled = { ...row, cancelled: true };
    assert.equal(plan([canceled]).writes[0].data.cancelled, true);
    const existing = asExisting(plan([row]));
    existing.data.paid = true;
    assert.deepEqual(plan([canceled], [existing]).entries[0].reasons, ['환수 확인 필요']);
    assert.equal(plan([canceled], [existing]).writes.length, 0);
  });
  it('시트에서 사라진 행은 확인 목록에만 남기고 금액 셀 오류는 그대로 보류한다', () => {
    const row = make();
    const gone = plan([], [asExisting(plan([row]))]);
    assert.equal(gone.serverOnlyReview[0].reason, '원천 없음');
    assert.equal(gone.writes.length, 0);
    for (const value of ['#REF!', '#VALUE!', '1,2,3', true]) {
      assert.match(plan([make([,,,,,,, value])]).entries[0].reasons[0], /금액·수치 셀 오류/);
    }
    assert.equal(plan([make([,,,,,,, '₩1,200'])]).writes[0].data.claimWritten, 1200);
    assert.equal(plan([make([,,,,,,, ''])]).writes[0].data.claimWritten, null);
    const explicitZero = f04SyncInput(picker([...headers, '보증금']), [...Array(headers.length), '무보증'], 1);
    assert.equal(explicitZero.deposit, 0);
    assert.deepEqual(explicitZero.invalidAmounts, []);
    const existing = asExisting(plan([row]));
    const changed = { ...row, model: '모델 B', claimWritten: 200, payWritten: 180 };
    assert.equal(plan([{ ...changed, billed: true }], [existing]).writes.length, 0);
    const update = plan([changed], [existing]).writes[0].data;
    for (const protectedKey of ['claimWritten', 'payWritten', 'paid', 'billed', 'collected', 'cancelled', 'stage']) {
      assert.equal(protectedKey in update, false);
    }
  });

  it('날짜 또는 차량번호가 없거나 동일 접수가 서버에 중복되면 쓰기 목록에서 제외한다', () => {
    assert.equal(plan([make(['', '2026-11-31'])]).entries[0].action, '보류');
    const cur = asExisting(plan([make()]));
    assert.equal(plan([make()], [cur, { ...cur, id: 'duplicate' }]).entries[0].action, '보류');
  });
});

describe('수수료표·접수 두 탭 운영', () => {
  it('기청구 상태 열이 없어지면 미발행으로 추정하지 않고 멈춘다', () => {
    const headers = ['차량번호', '접수일', '공급사', '청구년', '청구월', '청구액', '지급액', '청구', '청구상태'];
    assert.doesNotThrow(() => assertIntakeHeaders(headers));
    assert.throws(() => assertIntakeHeaders(headers.filter(h => h !== '청구')), /필수 열 없음: 청구/);
    assert.throws(() => assertIntakeHeaders(headers.filter(h => h !== '청구상태')), /필수 열 없음: 청구상태/);
  });
  it('회차를 포함한 옛 사본은 재발행 전에 거부한다', () => {
    assert.throws(() => assertIntakeOnlySnapshot({ report: { installments: 3 }, installments: [{}, {}, {}] }), /단일원장/);
    assert.throws(() => assertIntakeOnlySnapshot({ report: { ledgerMode: F04_LEDGER_MODE, installments: 0 }, installments: [{}] }), /단일원장/);
    assert.doesNotThrow(() => assertIntakeOnlySnapshot({ report: { ledgerMode: F04_LEDGER_MODE, installments: 0 }, installments: [] }));
  });
});

describe('serialToDate — ★구글 날짜는 숫자로 온다', () => {
  it('serial 을 날짜로 되돌린다', () => {
    assert.equal(serialToDate(46023), '2026-01-01');
    assert.equal(serialToDate(46266), '2026-09-01');
  });
  it('serial 이 아니면 null', () => {
    assert.equal(serialToDate(5), null);
    assert.equal(serialToDate(2026), null);
  });
  it('★그냥 Date 에 넣으면 45301년이 된다 — 그래서 이 함수가 있다', () => {
    assert.equal(new Date(45301).getUTCFullYear(), 1970);   // ms 로 읽힌다
    assert.equal(serialToDate(45301)?.slice(0, 4), '2024'); // 날짜로 읽으면 2024년
  });
});

describe('billMonthOf — ★청구월은 «두 칸» 에서 세운다', () => {
  it('시트가 들고 있는 꼴 — 년 따로, 달 숫자', () => {
    assert.equal(billMonthOf(2026, 9), '2026-09');
    assert.equal(billMonthOf('2026', '10'), '2026-10');
    assert.equal(billMonthOf(2026, 8), '2026-08');
  });
  it('★사람이 「2026-09」를 적어 구글이 날짜로 바꿔 놓은 것도 읽는다', () => {
    assert.equal(billMonthOf('', 46266), '2026-09');   // 46266 = 2026-09-01
    assert.equal(billMonthOf('', 46235), '2026-08');
  });
  it('글자로 적힌 「2026-09」도 읽는다', () => {
    assert.equal(billMonthOf(null, '2026-09'), '2026-09');
  });
  it('★년을 모르면 달도 «모른다» — 2026 을 넣어 주지 않는다', () => {
    assert.equal(billMonthOf('', 9), null);
    assert.equal(billMonthOf(null, 9), null);
  });
  it('빈칸은 null', () => {
    assert.equal(billMonthOf(2026, ''), null);
    assert.equal(billMonthOf('', ''), null);
  });
  it('달이 아닌 수는 안 받는다', () => {
    assert.equal(billMonthOf(2026, 13), null);
    assert.equal(billMonthOf(2026, 0), null);
  });
});

describe('cellNumber — ★빈칸을 0 으로 만들지 않는다', () => {
  it('수를 읽는다', () => {
    assert.equal(cellNumber(1_720_000), 1_720_000);
    assert.equal(cellNumber('1,720,000'), 1_720_000);
    assert.equal(cellNumber('0.0325'), 0.0325);
  });
  it('빈칸·못 읽음은 null 이다', () => {
    assert.equal(cellNumber(''), null);
    assert.equal(cellNumber(null), null);
    assert.equal(cellNumber('최대 9%'), null);
    assert.equal(cellNumber('미확인'), null);
  });
  it('0 은 0 이다 — null 이 아니다', () => {
    assert.equal(cellNumber(0), 0);
  });
});

describe('cellCheck — 「TRUE·참·Y·예·1」 이 섞여 있다', () => {
  it('켜진 것을 읽는다', () => {
    for (const v of [true, 'TRUE', 'true', '참', 'Y', '예', '1']) assert.equal(cellCheck(v), true, String(v));
  });
  it('꺼진 것', () => {
    for (const v of [false, 'FALSE', '', null, '아니오', 0]) assert.equal(cellCheck(v), false, String(v));
  });
});

describe('findHeader — ★1행은 안내문이라 머리글이 아니다', () => {
  const rows = [
    ['26년09월', '', '청구·지급 — 파이어베이스 원자에서 찍습니다'],
    ['접수일', '차량번호', '공급사'],
    ['2026-09-01', 'PLATE_F04_A', '예시공급사'],
  ];
  it('「차량번호」가 있는 줄을 찾는다', () => assert.equal(findHeader(rows), 1));
  it('★못 찾으면 -1 — 말없이 0 을 내지 않는다', () => {
    assert.equal(findHeader([['가', '나'], ['다']]), -1);
  });
});

describe('picker — ★자리가 아니라 «이름» 으로 붙인다', () => {
  const head = ['접수일', '차량번호', '공급사', '청구년', '청구월', '판매수수료', '인도완료'];
  const p = picker(head);
  const row = ['2026-09-01', 'PLATE_F04_A', '예시공급사', 2026, 9, 1_216_800, true];

  it('이름으로 집는다', () => {
    assert.equal(p.text(row, '차량번호'), 'PLATE_F04_A');
    assert.equal(p.num(row, '판매수수료'), 1_216_800);
    assert.equal(p.check(row, '인도완료'), true);
  });
  it('★없는 열은 «없다» 고 말한다 — 0 을 내지 않는다', () => {
    assert.equal(p.has('계산서'), false);
    assert.equal(p.num(row, '계산서'), null);
    assert.equal(p.text(row, '계산서'), null);
    assert.deepEqual(p.missing(['계산서', '입금일', '공급사']), ['계산서', '입금일']);
  });
  it('열이 앞뒤로 밀려도 이름이면 따라온다', () => {
    const p2 = picker(['차량번호', '접수일', '판매수수료']);
    assert.equal(p2.num(['PLATE_F04_A', '2026-09-01', 999], '판매수수료'), 999);
  });
});

describe('cellDate', () => {
  it('serial 과 글자 날짜를 둘 다 읽는다', () => {
    assert.equal(cellDate(46266), '2026-09-01');
    assert.equal(cellDate('2026-09-08'), '2026-09-08');
    assert.equal(cellDate('2026/9/8'), '2026-09-08');
  });
  it('못 읽으면 null', () => {
    assert.equal(cellDate(''), null);
    assert.equal(cellDate('미정'), null);
  });
});


describe('F04 settlement field mapping', () => {
  it('legacy 납입회차 rounds는 current paidRounds로 저장한다', () => {
    assert.equal(f04SettlementField('rounds'), 'paidRounds');
    assert.equal(f04SettlementField('paidRounds'), 'paidRounds');
    assert.equal(f04SettlementField('billMonth'), 'billMonth');
  });
});
