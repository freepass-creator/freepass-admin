import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { indexMaster, matchToMaster, type VehicleMasterNode } from '../master-match.js';

const node = (o: Partial<VehicleMasterNode>): VehicleMasterNode => ({
  id: 'n', maker: '기아', model: 'K8', subModel: 'K8', aliases: [], trims: [], yearStart: null, yearEnd: null, ...o,
});
const idx = indexMaster([
  node({ id: 'k8', trims: ['트렌디', '노블레스'] }),
  node({ id: 'k8pe', subModel: '더 뉴 K8', trims: ['베스트 셀렉션'] }),
  node({ id: 'mx5', maker: '현대', model: '싼타페', subModel: '싼타페 MX5', aliases: ['디 올 뉴 싼타페 MX5'], trims: ['익스클루시브'] }),
  node({ id: 'ray1', model: '레이', subModel: '더 뉴 레이', yearStart: 2017, yearEnd: 2022 }),
  node({ id: 'ray2', model: '레이', subModel: '더 뉴 레이', yearStart: 2023, yearEnd: null }),
]);

describe('matchToMaster — ★옛 HOLD 표시가 아니라 지금의 마스터로', () => {
  it('K8 트렌디 → TRIM (옛 표시는 「K8 이 마스터에 없다」 였다)', () =>
    assert.deepEqual(matchToMaster({ maker: '기아', model: 'K8', subModel: 'K8', trim: '트렌디' }, idx), { level: 'TRIM', nodeId: 'k8', why: null }));
  it('별칭으로도 붙는다 · 띄어쓰기는 안 가린다', () =>
    assert.equal(matchToMaster({ maker: '현대', model: '싼타페', subModel: '디 올 뉴  싼타페MX5', trim: '익스클루시브' }, idx).level, 'TRIM'));
  it('★트림 글자가 있어도 마스터 목록에 없으면 TRIM 이 아니다', () => {
    const m = matchToMaster({ maker: '기아', model: 'K8', subModel: 'K8', trim: '시그니처' }, idx);
    assert.equal(m.level, 'SUB_MODEL'); assert.match(m.why!, /트림 목록에 없다/);
  });
  it('세부모델이 마스터에 없으면 MODEL 에서 멈추고 까닭을 댄다', () => {
    const m = matchToMaster({ maker: '기아', model: 'K8', subModel: '올 뉴 K8 하이브리드' }, idx);
    assert.equal(m.level, 'MODEL'); assert.match(m.why!, /아래에 없다/);
  });
  it('같은 이름 두 노드 — 연식으로 좁히고, 못 좁히면 고르지 않는다', () => {
    assert.equal(matchToMaster({ maker: '기아', model: '레이', subModel: '더 뉴 레이', year: 2024 }, idx).nodeId, 'ray2');
    assert.equal(matchToMaster({ maker: '기아', model: '레이', subModel: '더 뉴 레이' }, idx).level, 'MODEL');
  });
  it('모델이 마스터에 없으면 UNMATCHED', () =>
    assert.equal(matchToMaster({ maker: '테슬라', model: '모델 Y', subModel: '모델 Y' }, idx).level, 'UNMATCHED'));
});
