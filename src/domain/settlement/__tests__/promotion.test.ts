import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AGENT_SHARE, describePromotion, emptyPromotion, isShare, parseSharePercent, promotionFromInput, splitPromotion,
} from '../promotion.js';

describe('★기본은 100% 다 — 대표 「기본 100%로 세팅해주고」', () => {
  it('빈 프로모션의 비율이 1 이다', () => {
    assert.equal(emptyPromotion().agentShare, 1);
    assert.equal(DEFAULT_AGENT_SHARE, 1);
  });
  it('금액만 넣으면 비율은 100% 로 선다', () => {
    const p = promotionFromInput('500000', undefined);
    assert.equal(p.amount, 500_000);
    assert.equal(p.agentShare, 1);
  });
});

describe('parseSharePercent — ★퍼센트«만» 받는다. 모호함이 돈을 흘린다', () => {
  it('사람이 적는 꼴', () => {
    assert.equal(parseSharePercent('100'), 1);
    assert.equal(parseSharePercent('50'), 0.5);
    assert.equal(parseSharePercent('50%'), 0.5);
    assert.equal(parseSharePercent(70), 0.7);
  });
  it('★「1」 은 1% 다 — 100% 가 «아니다»', () => {
    assert.equal(parseSharePercent('1'), 0.01);
    assert.equal(parseSharePercent(1.5), 0.015);
  });
  it('0 은 「한 푼도 안 준다」 — null 이 아니다', () => {
    assert.equal(parseSharePercent(0), 0);
    assert.equal(parseSharePercent('0'), 0);
  });
  it('★100 을 넘으면 null — 남의 돈이 나간다', () => {
    assert.equal(parseSharePercent('120'), null);
    assert.equal(parseSharePercent(101), null);
    assert.equal(parseSharePercent(-10), null);
  });
  it('빈칸은 null', () => {
    assert.equal(parseSharePercent(''), null);
    assert.equal(parseSharePercent(null), null);
    assert.equal(parseSharePercent('몰라'), null);
  });
  it('저장된 비율(0~1)은 isShare 로 본다 — 두 자리를 안 섞는다', () => {
    assert.equal(isShare(0.5), true);
    assert.equal(isShare(1), true);
    assert.equal(isShare(1.5), false);
  });
});

describe('splitPromotion — 대표 「추가 50인데 50 다 줄거면 100%」', () => {
  it('50만 · 100% → 영업자가 다 가져간다', () => {
    const s = splitPromotion({ amount: 500_000, agentShare: 1 });
    assert.deepEqual(s, { claim: 500_000, pay: 500_000, ours: 0, pending: false });
  });
  it('50만 · 50% → 반씩', () => {
    const s = splitPromotion({ amount: 500_000, agentShare: 0.5 });
    assert.deepEqual(s, { claim: 500_000, pay: 250_000, ours: 250_000, pending: false });
  });
  it('50만 · 0% → 우리가 다 갖는다', () => {
    const s = splitPromotion({ amount: 500_000, agentShare: 0 });
    assert.deepEqual(s, { claim: 500_000, pay: 0, ours: 500_000, pending: false });
  });
  it('프로모션이 없으면 아무것도 안 생긴다', () => {
    assert.deepEqual(splitPromotion({ amount: null, agentShare: 1 }),
      { claim: 0, pay: 0, ours: 0, pending: false });
  });
  it('★비율을 안 정했으면 «가르지 않고» 기다린다 — 0 으로 밀지 않는다', () => {
    const s = splitPromotion({ amount: 500_000, agentShare: null });
    assert.equal(s.pending, true);
    assert.equal(s.pay, 0);
    assert.equal(s.ours, 0);   /* ★우리 몫을 50만으로 세지 않는다 — 아직 모른다 */
  });
  it('★F04 실측 17하3915 — 30만 · 100%', () => {
    const s = splitPromotion({ amount: 300_000, agentShare: 1 });
    assert.equal(s.pay, 300_000);
    assert.equal(s.ours, 0);
  });
});

describe('promotionFromInput — 접수 칸에서 들어오는 것', () => {
  it('콤마와 「원」을 견딘다', () => {
    assert.equal(promotionFromInput('500,000원', '100').amount, 500_000);
  });
  it('★금액이 없으면 비율만 적힌 줄을 만들지 않는다', () => {
    const p = promotionFromInput('', '50');
    assert.equal(p.amount, null);
    assert.equal(p.agentShare, 1);   /* 기본으로 되돌린다 */
  });
  it('0 원은 프로모션이 «없는» 것이다', () => {
    assert.equal(promotionFromInput('0', '100').amount, null);
  });
  it('사유를 남긴다', () => {
    assert.equal(promotionFromInput('500000', '100', ' 9월 전기차 프로모션 ').reason, '9월 전기차 프로모션');
    assert.equal(promotionFromInput('500000', '100', '   ').reason, null);
  });
  it('비율이 말이 안 되면 null 로 둔다 — 조용히 100% 로 밀지 않는다', () => {
    assert.equal(promotionFromInput('500000', '150').agentShare, null);   /* 150% 는 안 받는다 */
  });
});

describe('describePromotion — 사람이 읽는 한 줄', () => {
  it('100% 면 전부 넘긴다고 말한다', () => {
    assert.match(String(describePromotion({ amount: 500_000, agentShare: 1 })), /전부 넘긴다/);
  });
  it('0% 면 전부 우리가 갖는다고 말한다', () => {
    assert.match(String(describePromotion({ amount: 500_000, agentShare: 0 })), /전부 우리가 갖는다/);
  });
  it('반반이면 우리 몫을 적는다', () => {
    assert.match(String(describePromotion({ amount: 500_000, agentShare: 0.5 })), /우리 몫 250,000원/);
  });
  it('★안 정했으면 안 정했다고 말한다', () => {
    assert.match(String(describePromotion({ amount: 500_000, agentShare: null })), /아직 안 정했다/);
  });
  it('프로모션이 없으면 아무 말도 안 한다', () => {
    assert.equal(describePromotion({ amount: null, agentShare: 1 }), null);
  });
});
