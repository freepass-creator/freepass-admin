import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '../../domain/product/types';
import { tallyMany } from '../_design/facet-standing';
import { lead, mergeProductSelections, offerWithinSearchLimits, parseProductSearch, vehicleFacetValue, 보증금 } from './workspace-config';

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
    status: [], kind: [], origin: [], maker: [], model: [], sub: [], trim: [], perk: [],
    term: [], rent: [], dep: [], supplier: [], cls: [], fuel: [], mile: [],
  };
  const merged = mergeProductSelections({ ...empty, perk: ['무심사'] }, { perk: ['무심사', '만21세'], term: ['36'] });
  assert.deepEqual(merged.perk, ['무심사', '만21세']);
  assert.deepEqual(merged.term, ['36']);
});

test('vehicle hierarchy facets expose only master-confirmed depth', () => {
  const modelOnly = { vehicle: {
    nodeId: 'model:k8', originId: '국산', manufacturerId: '기아', modelId: 'K8',
    subModelId: 'K8 하이브리드', trimId: '노블레스', matchLevel: 'MODEL' as const,
  } };
  assert.equal(vehicleFacetValue(modelOnly, 'maker'), '기아');
  assert.equal(vehicleFacetValue(modelOnly, 'model'), 'K8');
  assert.equal(vehicleFacetValue(modelOnly, 'sub'), '');
  assert.equal(vehicleFacetValue(modelOnly, 'trim'), '');

  const trim = { vehicle: { ...modelOnly.vehicle, matchLevel: 'TRIM' as const } };
  assert.equal(vehicleFacetValue(trim, 'sub'), 'K8 하이브리드');
  assert.equal(vehicleFacetValue(trim, 'trim'), '노블레스');

  const unmatched = { vehicle: { ...modelOnly.vehicle, matchLevel: 'UNMATCHED' as const } };
  assert.equal(vehicleFacetValue(unmatched, 'maker'), '');
});

test('multi-value facet counting counts each product once per value', () => {
  const counts = tallyMany([
    ['무심사', '무보증', '무심사'],
    ['무심사'],
    ['경력무관'],
  ], (values) => values);
  assert.equal(counts.get('무심사'), 2);
  assert.equal(counts.get('무보증'), 1);
  assert.equal(counts.get('경력무관'), 1);
});


test('natural search supports canonical age perks and known perk words', () => {
  const q = parseProductSearch('20세 소득확인 분납가능');
  assert.deepEqual(q.inferred.perk, ['만20세', '소득확인', '분납가능']);
  assert.equal(q.text, '');
});

test('age outside canonical perk range is not fabricated as a filter', () => {
  const q = parseProductSearch('26세');
  assert.equal(q.inferred.perk, undefined);
  assert.equal(q.text, '26세');
});

test('amount ceilings include the overlapping band and preserve the exact numeric ceiling', () => {
  const q = parseProductSearch('월 55만원 이하 보증금 150만원 이하');
  assert.deepEqual(q.inferred.rent, ['r50', 'r60']);
  assert.deepEqual(q.inferred.dep, ['d0', 'd1', 'd2']);
  assert.deepEqual(q.limits, { rentMax: 550_000, depositMax: 1_500_000 });
  assert.deepEqual(q.tokens.map((x) => x.label), ['보증금 150만원 이하', '월 55만원 이하']);
  assert.equal(q.text, '');
});

test('exact amount ceilings do not lose valid offers inside a coarse facet band', () => {
  const limits = parseProductSearch('월 55만원 이하 보증금 150만원 이하').limits;
  assert.equal(offerWithinSearchLimits({ monthlyRent: 520_000, deposit: 1_200_000 }, limits), true);
  assert.equal(offerWithinSearchLimits({ monthlyRent: 560_000, deposit: 1_200_000 }, limits), false);
  assert.equal(offerWithinSearchLimits({ monthlyRent: 520_000, deposit: 1_600_000 }, limits), false);
  assert.equal(offerWithinSearchLimits({ monthlyRent: 520_000, deposit: undefined }, limits), false);
});
