import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adjustPatch, adjustmentFromInput, moneyEditPatch, promotionFromInput, promotionPatch } from '../adjust.js';
import { claimAmountOf, payAmountOf } from '../ledgers.js';
import { intakeRecord } from '../intake.js';
import { toSettlementRow } from '../../../adapters/erp5/to-settlement.js';

describe('프로모션 — 대표 「기본 100%」', () => {
  it('몫을 비우면 100% — 공급사 50만 → 영업자 50만', () =>
    assert.deepEqual(promotionPatch(promotionFromInput('500,000', '', '전기차 프로모션')),
      { claimIncentive: 500_000, payIncentive: 500_000, promoShare: 1, promoReason: '전기차 프로모션' }));
  it('60% 면 영업자 30만 · 우리 20만', () =>
    assert.equal(promotionPatch(promotionFromInput(500_000, '60', '')).payIncentive, 300_000));
  it('금액이 없으면 0 으로 지운다', () =>
    assert.deepEqual(promotionPatch(promotionFromInput('', '60', 'x')), { claimIncentive: 0, payIncentive: 0, promoShare: null, promoReason: '' }));
});

describe('가감 — ★사유 없는 돈은 안 받는다', () => {
  it('빼는 돈은 − 로', () => {
    const a = adjustmentFromInput('-100,000', '', '공급사 협의 감액');
    assert.deepEqual(a.ok && adjustPatch(a.adjust), { claimAdjust: -100_000, payAdjust: 0, adjustReason: '공급사 협의 감액' });
  });
  it('사유가 없으면 거절', () => assert.equal(adjustmentFromInput('50000', '', '').ok, false));
  it('숫자가 아니면 거절', () => assert.equal(adjustmentFromInput('오만원', '', '이유').ok, false));
});

describe('프로모션/가감 수정 잠금 — 발행된 문서와 원장이 갈리지 않는다', () => {
  it('청구서 뒤 청구축, 지급명세 통보 뒤 지급축을 막는다', () => {
    assert.equal(moneyEditPatch({ billed: true, claimIncentive: 0 }, { claimIncentive: 100 }).ok, false);
    assert.equal(moneyEditPatch({ payStage: '통보', payIncentive: 0 }, { payIncentive: 100 }).ok, false);
    assert.equal(moneyEditPatch({ payStage: '확인', payAdjust: 0 }, { payAdjust: -100 }).ok, false);
  });
  it('레거시 Y/1/참 완료표시도 발행·취소 잠금으로 본다', () => {
    assert.equal(moneyEditPatch({ billed: 'Y', claimAdjust: 0 }, { claimAdjust: 1 }).ok, false);
    assert.equal(moneyEditPatch({ paid: 1, payAdjust: 0 }, { payAdjust: 1 }).ok, false);
    assert.equal(moneyEditPatch({ cancelled: '참', claimAdjust: 0 }, { claimAdjust: 1 }).ok, false);
  });
  it('발행 전에는 바뀐 칸만 패치하고 같은 값은 쓰지 않는다', () => {
    const r = moneyEditPatch({ claimAdjust: 0, payAdjust: 5, payStage: '접수' }, { claimAdjust: -10, payAdjust: 5, unknown: 1 });
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.patch, { claimAdjust: -10 });
  });
});

describe('금액 식 — (수수료 + 프로모션) × 비율 + 가감', () => {
  const row = (o: Record<string, unknown>) => toSettlementRow({ code: 'x', plate: '1가1', receivedAt: '2026-09-01', claimWritten: 1_000_000, payWritten: 800_000, ...o }, 'x').row;
  it('프로모션을 더하고 가감은 비율을 안 곱한다', () => {
    const r = row({ claimIncentive: 500_000, payIncentive: 500_000, settleRatio: 0.5, claimAdjust: -100_000, payAdjust: 20_000 });
    assert.equal(claimAmountOf(r), 750_000 - 100_000);
    assert.equal(payAmountOf(r), 650_000 + 20_000);
  });
  it('★정정금액(supplierFixAmt)은 더하지 않는다 — 정정 요청 금액이지 가감이 아니다', () =>
    assert.equal(claimAmountOf(row({ supplierFix: true, supplierFixAmt: 1_000_000 })), 1_000_000));
});

describe('접수에 프로모션이 실린다', () => {
  const x = {
    receivedAt: '2026-09-18', plate: '12가3456', model: 'EV6', supplier: '오토플러스', supplierCode: '', customer: '홍길동',
    channel: '하허호', channelCode: '', agent: '김', agentCode: '', product: '오플구독', rentKind: '', contractType: '',
    term: 24, rent: 800_000, deposit: 0, price: null, payKind: '일시납', paper: false, delivered: false, deliveredAt: '', note: '',
    promotion: promotionFromInput(300_000, '', '9월 프로모션'),
  };
  it('claimIncentive · payIncentive · 가감 0 칸까지 선다', () => {
    const r = intakeRecord(x, 0);
    assert.deepEqual([r.claimIncentive, r.payIncentive, r.promoShare, r.claimAdjust, r.payAdjust], [300_000, 300_000, 1, 0, 0]);
  });
});
