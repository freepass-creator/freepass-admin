import test from 'node:test';
import assert from 'node:assert/strict';
import { intakeNextAction } from '../next-action';

test('접수 하단 주 액션은 다음 업무를 그대로 따른다', () => {
  assert.deepEqual(intakeNextAction('계약서', false, false), { kind: 'paper' });
  assert.deepEqual(intakeNextAction('차량번호 없음', false, false), { kind: 'plate' });
  assert.deepEqual(intakeNextAction('인도', false, false), { kind: 'delivered' });
});

test('인도 뒤 정산 막힘은 청구/지급 탭으로 보낸다', () => {
  assert.deepEqual(intakeNextAction('청구', false, true), { kind: 'settlement', tab: 'claim' });
  assert.deepEqual(intakeNextAction('계산서', false, true), { kind: 'settlement', tab: 'claim' });
  assert.deepEqual(intakeNextAction('지급', false, true), { kind: 'settlement', tab: 'pay' });
  assert.deepEqual(intakeNextAction('영업채널 없음', false, true), { kind: 'settlement', tab: 'pay' });
});

test('값 입력이나 상대 확인이 먼저인 막힘은 섣불리 다른 화면으로 보내지 않는다', () => {
  assert.deepEqual(intakeNextAction('공급사 없음', false, false), { kind: 'blocked', label: '공급사 없음' });
});

test('완료나 취소 건은 신규접수로 이어질 수 있다', () => {
  assert.deepEqual(intakeNextAction(null, false, true), { kind: 'new' });
  assert.deepEqual(intakeNextAction('계약서', true, false), { kind: 'new' });
});
