import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  billMonthOf, cellCheck, cellDate, cellNumber, f04SettlementField, feeValueOf, findHeader, methodOf, picker, serialToDate,
} from '../sheet.js';

/* 값은 F04 시트 실측(2026-09-17)에서 그대로 딴 것이다. */

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
    ['2026-09-01', '101하8595', '스타스카이'],
  ];
  it('「차량번호」가 있는 줄을 찾는다', () => assert.equal(findHeader(rows), 1));
  it('★못 찾으면 -1 — 말없이 0 을 내지 않는다', () => {
    assert.equal(findHeader([['가', '나'], ['다']]), -1);
  });
});

describe('picker — ★자리가 아니라 «이름» 으로 붙인다', () => {
  const head = ['접수일', '차량번호', '공급사', '청구년', '청구월', '판매수수료', '인도완료'];
  const p = picker(head);
  const row = ['2026-09-01', '101하8595', '스타스카이', 2026, 9, 1_216_800, true];

  it('이름으로 집는다', () => {
    assert.equal(p.text(row, '차량번호'), '101하8595');
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
    assert.equal(p2.num(['101하8595', '2026-09-01', 999], '판매수수료'), 999);
  });
});

describe('수수료표 — ★셈법 일곱', () => {
  it('아는 셈법을 읽는다', () => {
    assert.equal(methodOf('대여료×기간'), '대여료×기간');
    assert.equal(methodOf('정액'), '정액');
    assert.equal(methodOf('차량가액'), '차량가액');
  });
  it('모르는 말은 「알 수 없음」 — 지어내지 않는다', () => {
    assert.equal(methodOf('새로운셈법'), '알 수 없음');
    assert.equal(methodOf(''), '알 수 없음');
  });
  it('요율을 읽는다', () => {
    assert.equal(feeValueOf(0.0475, '대여료×기간'), 0.0475);
    assert.equal(feeValueOf(600_000, '정액'), 600_000);
    assert.equal(feeValueOf(0.035, '차량가액'), 0.035);
  });
  it('★「사람이 정한다」 셈법은 수로 읽지 «않는다»', () => {
    assert.equal(feeValueOf('최대 9%', '범위'), null);
    assert.equal(feeValueOf('12개월구독료 100% + 30만', '구독료+정액'), null);
    assert.equal(feeValueOf(0.09, '범위'), null);   /* 수가 있어도 안 읽는다 — 사람 몫이다 */
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
