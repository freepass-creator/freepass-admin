import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { productSections, settlementSections } from '../sections.js';
import type { CanonicalProduct } from '../../product/types.js';

const p: CanonicalProduct = {
  id: 'P1', version: 1, supplierId: 'RP001', supplierName: '손오공', supplierProductKey: '12가3456',
  vehicle: { nodeId: 'n', originId: '', manufacturerId: '기아', modelId: 'K8', subModelId: 'K8', trimId: '트렌디', matchLevel: 'TRIM' },
  specs: { modelYear: 2024 }, offers: [], sourceSnapshotId: 's', updatedAt: '',
  productPolicies: [
    { policyId: 'basic_driver_age', type: 'NUMBER', value: 26 },
    { policyId: 'screening_criteria', type: 'TEXT', value: '저신용' },
    { policyId: 'content', type: 'TEXT', value: '설명 글' },
  ],
};

describe('productSections — 성격별 구역', () => {
  const s = productSections(p);
  it('차량 · 제원 · 색상·옵션 · 출고 · 공급 · 매칭 · 심사·혜택 · 정책 세 층이 따로 선다', () =>
    assert.deepEqual(s.map((x) => x.key).slice(0, 10),
      ['vehicle', 'spec', 'look', 'release', 'supply', 'match', 'screening', 'policy_product', 'policy_sales', 'policy_contract']));
  it('★값이 없어도 칸은 남는다 (null)', () =>
    assert.equal(s.find((x) => x.key === 'spec')!.items.find((i) => i.key === 'fuel_type')!.value, null));
  it('정책은 사전(erp4 policy-tier)의 층·노출을 따른다 — 심사기준은 내부 전용', () => {
    const all = s.flatMap((x) => x.items);
    assert.equal(all.find((i) => i.key === 'basic_driver_age')!.value, 26);
    const sc = all.find((i) => i.key === 'screening_criteria');
    assert.equal(sc?.exposure, 'internal');
  });
  it('사전에 없는 정책 칸은 버리지 않고 따로 모은다', () =>
    assert.ok(s.find((x) => x.key === 'policy_other')!.items.some((i) => i.key === 'content')));
  it('선택 Offer 정책이 상품 정책을 덮어 화이트라벨과 같은 적용값을 보여준다', () => {
    const selected = {
      id: 'O-A#36_2만', sourceOfferId: 'O-A', policyId: 'POL-A', offerRevision: 3,
      policyState: 'COMPLETE' as const, termMonths: 36, monthlyRent: 690_000,
      policyValues: [{ policyId: 'basic_driver_age', type: 'NUMBER' as const, value: 21 }],
    };
    const sections = productSections(p, selected);
    const age = sections.flatMap((x) => x.items).find((x) => x.key === 'basic_driver_age');
    assert.equal(age?.value, 21);
    assert.match(sections.find((x) => x.key === 'policy_product')?.hint ?? '', /POL-A/);
  });
});

describe('settlementSections — erp4 묶음 그대로 + 새 칸', () => {
  const s = settlementSections({ code: 'stl_x', claimWritten: 1_000_000, claimAdjust: -50_000, adjustReason: '협의' });
  it('묶음 차례', () => assert.deepEqual(s.map((x) => x.key), ['정체', '상대', '조건', '요율·돈', '날', '정산 축', '상태', '이월', '출처']));
  it('가감이 「요율·돈」 에 붙고 돈 꼴이다', () => {
    const m = s.find((x) => x.key === '요율·돈')!.items;
    assert.deepEqual(m.find((i) => i.key === 'claimAdjust'), { key: 'claimAdjust', label: '가감(청구)', value: -50_000, type: 'money' });
  });
});
