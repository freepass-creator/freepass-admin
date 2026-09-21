import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '../../domain/product/types';
import { lead, mergeProductSelections, parseProductSearch, 보증금 } from './workspace-config';

const offer = (id: string, monthlyRent: number): Offer => ({
  id,
  termMonths: 36,
  monthlyRent,
  policyValues: [],
});

test('lead excludes buyout offers when a normal offer exists', () => {
  const picked = lead([
    offer('36개월_인수형', 100_000),
    offer('36개월_일반', 500_000),
    offer('36개월_일반2', 450_000),
  ]);
  assert.equal(picked?.id, '36개월_일반2');
});

test('lead falls back to buyout offers when they are the only offers', () => {
  const picked = lead([
    offer('36개월_인수형', 300_000),
    offer('48개월_인수형', 250_000),
  ]);
  assert.equal(picked?.id, '48개월_인수형');
});

test('deposit display keeps unknown distinct from zero', () => {
  assert.equal(보증금(undefined), '—');
  assert.equal(보증금(null), '—');
  assert.equal(보증금(0), '없음');
  assert.equal(보증금(1_000_000), '1,000,000원');
});


test('natural product search extracts arbitrary term and common business conditions', () => {
  const q = parseProductSearch('싼타페 27개월 연 2만km 무보증 21세 하이브리드 즉시출고');
  assert.equal(q.text, '싼타페');
  assert.deepEqual(q.inferred.term, ['27']);
  assert.deepEqual(q.inferred.dep, ['d0']);
  assert.deepEqual(q.inferred.mile, ['20000']);
  assert.deepEqual(q.inferred.perk, ['만21세']);
  assert.deepEqual(q.inferred.fuel, ['하이브리드']);
  assert.deepEqual(q.inferred.status, ['즉시출고']);
});

test('natural product search keeps unknown words as free text', () => {
  const q = parseProductSearch('그랜저 프리미엄 36개월');
  assert.equal(q.text, '그랜저 프리미엄');
  assert.deepEqual(q.inferred.term, ['36']);
});

test('parsed conditions merge with explicit facet state without duplicates', () => {
  const empty = {
    status: [], kind: [], perk: [], term: [], rent: [], dep: [], supplier: [], cls: [], fuel: [],
  };
  const merged = mergeProductSelections({ ...empty, perk: ['무심사'] }, { perk: ['무심사', '만21세'], term: ['36'] });
  assert.deepEqual(merged.perk, ['무심사', '만21세']);
  assert.deepEqual(merged.term, ['36']);
});


test('natural search supports dynamic age and known perk words', () => {
  const q = parseProductSearch('26세 소득확인 분납가능');
  assert.deepEqual(q.inferred.perk, ['만26세', '소득확인', '분납가능']);
  assert.equal(q.text, '');
});

test('amount ceilings map into the same existing rent and deposit bands', () => {
  const q = parseProductSearch('월 70만원 이하 보증금 100만원 이하');
  assert.deepEqual(q.inferred.rent, ['r50', 'r60', 'r70']);
  assert.deepEqual(q.inferred.dep, ['d0', 'd1']);
  assert.equal(q.text, '');
});
