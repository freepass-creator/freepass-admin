import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '../../domain/product/types';
import { lead, mergeProductSelections, offerWithinSearchLimits, parseProductSearch, productMeetsSearchRequirements, productWithinSearchLimits, 보증금 } from './workspace-config';

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
  assert.deepEqual(q.inferred.perk, undefined);
  assert.equal(q.requirements.driverAge, 21);
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
    status: [], vc: [], kind: [], perk: [], term: [], rent: [], dep: [], mile: [],
    maker: [], model: [], cls: [], year: [], vmile: [], fuel: [], credit: [], supplier: [],
  };
  const merged = mergeProductSelections({ ...empty, perk: ['무심사'] }, { perk: ['무심사', '만21세'], term: ['36'] });
  assert.deepEqual(merged.perk, ['무심사', '만21세']);
  assert.deepEqual(merged.term, ['36']);
});


test('natural search supports canonical age perks and known perk words', () => {
  const q = parseProductSearch('20세 소득확인 분납가능');
  assert.deepEqual(q.inferred.perk, undefined);
  assert.deepEqual(q.requirements, { perks: ['소득확인', '분납가능'], driverAge: 20 });
  assert.equal(q.text, '');
});

test('age outside canonical perk range is not fabricated as a filter', () => {
  const q = parseProductSearch('26세');
  assert.equal(q.inferred.perk, undefined);
  assert.deepEqual(q.requirements, { perks: [] });
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


test('natural perk requirements are AND, not same-axis OR', () => {
  const q = parseProductSearch('무심사 21세 경력무관');
  assert.deepEqual(q.requirements, { perks: ['무심사', '경력무관'], driverAge: 21 });

  assert.equal(productMeetsSearchRequirements({ perks: ['무심사', '만21세', '경력무관'] }, q.requirements), true);
  assert.equal(productMeetsSearchRequirements({ perks: ['무심사', '만21세'] }, q.requirements), false);
  assert.equal(productMeetsSearchRequirements({ perks: ['만21세', '경력무관'] }, q.requirements), false);
});

test('21-year-old search includes products with lower minimum driver age', () => {
  const q = parseProductSearch('21세');
  assert.equal(productMeetsSearchRequirements({ perks: ['만18세'] }, q.requirements), true);
  assert.equal(productMeetsSearchRequirements({ perks: ['만20세'] }, q.requirements), true);
  assert.equal(productMeetsSearchRequirements({ perks: ['만21세'] }, q.requirements), true);
  assert.equal(productMeetsSearchRequirements({ perks: [] }, q.requirements), false);
});


test('mileage search separates annual contract mileage from current vehicle mileage', () => {
  const q = parseProductSearch('연 2만km 주행 5만km 이하');
  assert.deepEqual(q.inferred.mile, ['20000']);
  assert.deepEqual(q.inferred.vmile, ['m1', 'm3', 'm5']);
  assert.equal(q.limits.vehicleMileageMax, 50_000);
  assert.deepEqual(q.tokens.map((x) => x.label), ['연 2만km', '현재 주행 5만km 이하']);
  assert.equal(q.text, '');
});

test('bare mileage means current vehicle mileage, not annual contract mileage', () => {
  const q = parseProductSearch('3만km');
  assert.equal(q.inferred.mile, undefined);
  assert.deepEqual(q.inferred.vmile, ['m1', 'm3']);
  assert.equal(q.limits.vehicleMileageMax, 30_000);
});

test('current mileage exact limit rejects unknown and over-limit vehicles', () => {
  const limits = parseProductSearch('주행 5만km 이하').limits;
  assert.equal(productWithinSearchLimits({ specs: { mileageKm: 49_999 } }, limits), true);
  assert.equal(productWithinSearchLimits({ specs: { mileageKm: 50_001 } }, limits), false);
  assert.equal(productWithinSearchLimits({ specs: {} }, limits), false);
  assert.equal(productWithinSearchLimits({ specs: { mileageKm: 0 } }, limits), false);
});
