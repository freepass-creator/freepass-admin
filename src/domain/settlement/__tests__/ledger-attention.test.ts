import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerGroupAttention, sortLedgerGroups, type LedgerGroup } from '../ledgers';

const group = ({
  party,
  lines = 1,
  done = 0,
  unknown = 0,
  broken = 0,
  hold = 0,
  clawbacks = 0,
  net = 0,
}: {
  party: string;
  lines?: number;
  done?: number;
  unknown?: number;
  broken?: number;
  hold?: number;
  clawbacks?: number;
  net?: number;
}): LedgerGroup => ({
  party,
  lines: Array.from({ length: lines }, () => ({} as LedgerGroup['lines'][number])),
  rows: [],
  total: net,
  unknown,
  done,
  hold,
  forecast: 0,
  broken,
  clawbacks: Array.from({ length: clawbacks }, () => ({} as LedgerGroup['clawbacks'][number])),
  clawbackTotal: 0,
  net,
});

test('정산 묶음은 환수·금액모름·끊김을 이슈로 본다', () => {
  assert.equal(ledgerGroupAttention(group({ party: '환수', lines: 0, done: 0, clawbacks: 1 })), 'issue');
  assert.equal(ledgerGroupAttention(group({ party: '금액', unknown: 1 })), 'issue');
  assert.equal(ledgerGroupAttention(group({ party: '끊김', broken: 1 })), 'issue');
});

test('정산 묶음은 미처리와 완료를 구분한다', () => {
  assert.equal(ledgerGroupAttention(group({ party: '대기', lines: 3, done: 1 })), 'todo');
  assert.equal(ledgerGroupAttention(group({ party: '보류', lines: 1, done: 1, hold: 1 })), 'todo');
  assert.equal(ledgerGroupAttention(group({ party: '완료', lines: 2, done: 2 })), 'done');
});

test('정산 묶음 순서는 금액보다 이슈와 미처리를 우선한다', () => {
  const done = group({ party: '완료큰금액', lines: 1, done: 1, net: 100_000_000 });
  const todo = group({ party: '미처리', lines: 3, done: 1, net: 10_000 });
  const issue = group({ party: '금액모름', lines: 1, unknown: 1, net: 1 });
  assert.deepEqual(sortLedgerGroups([done, todo, issue]).map((x) => x.party), ['금액모름', '미처리', '완료큰금액']);
});

test('같은 우선순위에서는 이슈 수·미처리 수·금액 순으로 정렬한다', () => {
  const oneIssue = group({ party: '이슈1', unknown: 1, net: 1_000_000 });
  const twoIssue = group({ party: '이슈2', unknown: 1, broken: 1, net: 1 });
  assert.deepEqual(sortLedgerGroups([oneIssue, twoIssue]).map((x) => x.party), ['이슈2', '이슈1']);

  const oneTodo = group({ party: '할일1', lines: 2, done: 1, net: 10_000_000 });
  const twoTodo = group({ party: '할일2', lines: 3, done: 1, net: 1 });
  assert.deepEqual(sortLedgerGroups([oneTodo, twoTodo]).map((x) => x.party), ['할일2', '할일1']);
});
