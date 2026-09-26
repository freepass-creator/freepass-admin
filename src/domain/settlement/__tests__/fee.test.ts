import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feeOf, type FeeRuleSet } from '../fee.js';
import { intakeRecord } from '../intake.js';

const W = '보증금·대여료 회차 완납';
const set: FeeRuleSet = {
  version: 'test',
  aliases: { 엘씨렌트: '빌린카' },
  evModel: '\\bEV\\d?\\b|아이오닉\\s*[56]',
  kindRules: [
    { match: '견적출고|매칭출고', kind: '신차', form: '매칭출고' },
    { match: '신차발주', kind: '신차', form: '발주' },
    { match: '선출고', kind: '신차', form: '선출고', evKind: '전기차', evFallback: '신차' },
    { match: '구독', kind: '구독', evKind: '전기차', evFallback: '구독' },
  ],
  rules: [
    { id: 'a', supplier: '손오공', kind: '신차', form: '선출고', term: 0, basis: '차량가액', claim: 0.035, pay: 0.03, when: W, auto: true },
    { id: 'b', supplier: '손오공', kind: '신차', form: '발주', term: 0, basis: '범위', claim: '건별 책정', pay: '건별 책정', when: W, auto: false },
    { id: 'c', supplier: '손오공', kind: '재렌트', form: '', term: 12, basis: '정액', claim: 600_000, pay: 500_000, when: W, auto: true },
    { id: 'd', supplier: '손오공', kind: '재렌트', form: '', term: 48, basis: '대여료×기간', claim: 0.0325, pay: 0.025, when: W, auto: true },
    { id: 'e', supplier: '오토플러스', kind: '구독', form: '', term: 0, basis: '정액', claim: 1_000_000, pay: 800_000, when: W, auto: true },
    { id: 'f', supplier: '오토플러스', kind: '전기차', form: '', term: 0, basis: '정액', claim: 1_500_000, pay: 1_300_000, when: W, auto: true },
    { id: 'g', supplier: '빌린카', kind: '구독', form: '', term: 60, basis: '대여료×기간', claim: 0.0275, pay: 0.02, when: W, auto: true },
  ],
};
const c = (o: Partial<{ supplier: string; product: string; model: string; term: number; rent: number; price: number }>) =>
  ({ supplier: null, product: null, model: null, term: null, rent: null, price: null, ...o });

describe('feeOf — 규칙은 데이터 (ERP5 settlement_fee_rules)', () => {
  it('재렌트 48개월 = 대여료 × 48 × 3.25% (전례 17하3915 사다리)', () => {
    const f = feeOf(set, c({ supplier: '손오공', product: '장기렌트', term: 48, rent: 700_000 }));
    assert.deepEqual(f.status === 'AUTO' && [f.claim, f.pay], [1_092_000, 840_000]);
  });
  it('12개월은 정액 · 이름 꼬리(주)는 안 가린다', () => {
    const f = feeOf(set, c({ supplier: '손오공(주)', product: '장기렌트', term: 12, rent: 500_000 }));
    assert.deepEqual(f.status === 'AUTO' && [f.claim, f.pay], [600_000, 500_000]);
  });
  it('★오플 전기차 프로모션 — HEV 는 전기차가 아니다', () => {
    const ev = feeOf(set, c({ supplier: '오토플러스', product: '오플구독', model: 'EV6' }));
    assert.equal(ev.status === 'AUTO' && ev.claim, 1_500_000);
    const hev = feeOf(set, c({ supplier: '오토플러스', product: '오플구독', model: 'K5 HEV' }));
    assert.equal(hev.status === 'AUTO' && hev.claim, 1_000_000);
  });
  it('★신차발주는 «주는 대로» — 선출고로 세지 않는다', () =>
    assert.equal(feeOf(set, c({ supplier: '손오공', product: '신차발주', price: 50_000_000 })).status, 'MANUAL'));
  it('별칭으로 붙는다 (엘씨렌트 = 빌린카)', () =>
    assert.equal(feeOf(set, c({ supplier: '엘씨렌트', product: '구독', term: 60, rent: 400_000 })).status, 'AUTO'));
  it('표에 없으면 NO_RULE · 밑값 없으면 NO_BASE — 0 으로 세지 않는다', () => {
    assert.equal(feeOf(set, c({ supplier: 'JPK', product: '장기렌트', term: 48, rent: 1 })).status, 'NO_RULE');
    assert.equal(feeOf(set, c({ supplier: '손오공', product: '장기렌트', term: 48 })).status, 'NO_BASE');
  });
});

describe('접수에 수수료가 선다', () => {
  const x = {
    receivedAt: '2026-09-18', plate: '12가3456', model: 'K8', supplier: '손오공', supplierCode: '', customer: '홍길동',
    channel: '하허호', channelCode: '', agent: '김', agentCode: '', product: '장기렌트', rentKind: '', contractType: '',
    term: 48, rent: 700_000, deposit: 0, price: null, payKind: '일시납', paper: false, delivered: false, deliveredAt: '', note: '',
  };
  it('AUTO 면 요율·금액과 근거(규칙 id)를 박는다', () => {
    const r = intakeRecord(x, 0, feeOf(set, x), 'fee-test');
    assert.deepEqual([r.supplierRate, r.agentRate, r.claimWritten, r.payWritten], [0.0325, 0.025, 1_092_000, 840_000]);
    assert.match(String(r.settleNote), /fee-test · d/);
  });
  it('사람이 정하는 규칙이면 0 으로 두고 까닭을 남긴다', () => {
    const y = { ...x, product: '신차발주' };
    const r = intakeRecord(y, 0, feeOf(set, y), 'fee-test');
    assert.equal(r.claimWritten, 0);
    assert.match(String(r.settleNote), /사람이 정한다/);
  });
});


describe('feeOf — 깨진 자동 규칙은 조용히 금액을 만들지 않는다', () => {
  const contract = c({ supplier: '손오공', product: '장기렌트', term: 48, rent: 700_000 });

  it('비율형 자동 규칙의 음수/100% 초과를 수동확인으로 내린다', () => {
    const badNeg: FeeRuleSet = { ...set, rules: [{ ...set.rules[3], claim: -0.1 }] };
    assert.equal(feeOf(badNeg, contract).status, 'MANUAL');

    const badOver: FeeRuleSet = { ...set, rules: [{ ...set.rules[3], pay: 1.2 }] };
    assert.equal(feeOf(badOver, contract).status, 'MANUAL');
  });

  it('정액 자동 규칙의 음수 금액을 수동확인으로 내린다', () => {
    const bad: FeeRuleSet = { ...set, rules: [{ ...set.rules[2], claim: -1 }] };
    assert.equal(feeOf(bad, c({ supplier: '손오공', product: '장기렌트', term: 12, rent: 500_000 })).status, 'MANUAL');
  });

  it('지원하지 않는 basis가 실수로 auto=true여도 임의 계산하지 않는다', () => {
    const bad: FeeRuleSet = { ...set, rules: [{
      ...set.rules[3], basis: '한달렌탈료', claim: 0.5, pay: 0.4, auto: true,
    }] };
    assert.equal(feeOf(bad, contract).status, 'MANUAL');
  });

  it('음수/0 기준값은 자동 계산하지 않는다', () => {
    assert.equal(feeOf(set, c({ supplier: '손오공', product: '장기렌트', term: 48, rent: -1 })).status, 'NO_BASE');
    assert.equal(feeOf(set, c({ supplier: '손오공', product: '장기렌트', term: 48, rent: 0 })).status, 'NO_BASE');
  });
});


describe('feeOf — 깨진 SSOT 정규식은 접수 전체를 죽이지 않는다', () => {
  it('전기차 정규식이 깨지면 NO_RULE로 내려 사람 확인을 요구한다', () => {
    const bad: FeeRuleSet = { ...set, evModel: '[' };
    const result = feeOf(bad, c({ supplier: '손오공', product: '장기렌트', model: 'EV6', term: 48, rent: 700_000 }));
    assert.equal(result.status, 'NO_RULE');
  });

  it('갈래 match 정규식이 깨져도 NO_RULE로 내려간다', () => {
    const bad: FeeRuleSet = { ...set, kindRules: [{ match: '[', kind: '재렌트' }] };
    const result = feeOf(bad, c({ supplier: '손오공', product: '장기렌트', model: 'K8', term: 48, rent: 700_000 }));
    assert.equal(result.status, 'NO_RULE');
  });
});
