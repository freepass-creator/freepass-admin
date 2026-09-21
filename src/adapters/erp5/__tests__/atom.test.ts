import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { numOrNull, numOrUndef, numOrZero, positiveNumOrUndef, strOf, strOrUndef } from '../atom.js';

describe('strOf · strOrUndef', () => {
  it('공백만 벗긴다 · 없으면 빈 글자', () => {
    assert.equal(strOf('  손오공  '), '손오공');
    assert.equal(strOf(undefined), '');
    assert.equal(strOf(null), '');
  });
  it('strOrUndef 는 빈 글자를 undefined 로', () => {
    assert.equal(strOrUndef(''), undefined);
    assert.equal(strOrUndef('  '), undefined);
    assert.equal(strOrUndef('x'), 'x');
  });
});

describe('숫자 읽기 — 콤마·공백·「원」을 버린다', () => {
  it('숫자 타입은 그대로(유한할 때만)', () => {
    assert.equal(numOrUndef(1000), 1000);
    assert.equal(numOrUndef(NaN), undefined);
    assert.equal(numOrUndef(Infinity), undefined);
  });
  it('글자 꼴 — 「1,720,000원」 「200 원」', () => {
    assert.equal(numOrUndef('1,720,000원'), 1_720_000);
    assert.equal(numOrUndef('200 원'), 200);
  });
  it('★못 읽으면 numOrUndef 는 undefined · numOrNull 은 null · numOrZero 는 0', () => {
    assert.equal(numOrUndef('불가'), undefined);
    assert.equal(numOrNull('불가'), null);
    assert.equal(numOrZero('불가'), 0);
    assert.equal(numOrUndef(''), undefined);
    assert.equal(numOrUndef(undefined), undefined);
  });
  it('★콤마·공백만 있어 다듬으면 빈 글자가 되는 값은 «0 이 아니라 모른다»', () => {
    /* 옛 contract-repository 판은 Number(",")===0 을 그대로 돌려주는 구멍이 있었다 — 여기서는 막는다 */
    assert.equal(numOrNull(','), null);
    assert.equal(numOrUndef(' '), undefined);
  });
  it('positiveNumOrUndef — 0 이하는 «안 적힌 것과 같다»', () => {
    assert.equal(positiveNumOrUndef('0'), undefined);
    assert.equal(positiveNumOrUndef('-5'), undefined);
    assert.equal(positiveNumOrUndef('83,000'), 83_000);
  });
});
