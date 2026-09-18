import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '../../domain/product/types';
import { lead, 보증금 } from './workspace-config';

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
