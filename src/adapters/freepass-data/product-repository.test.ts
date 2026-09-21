import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCatalogV1 } from '../../contracts/freepass-data/catalog-v1';
import { toAdminProduct } from './product-repository';

const fixture = {
  data: [{
    productId: 'prod-1', productRevision: 7, vehicleModelId: 'vm-1', vehicleAssetId: 'va-1',
    displayName: '테스트차', commercialType: 'USED_RENT',
    vehicle: { maker: '기아', model: 'K8', generation: 'GL3', trim: '노블레스', plateNumber: '00가0000' },
    offers: [{ offerId: 'offer-1', supplierId: 'supplier-1', offerRevision: 3, priceTerms: [
      { termKey: '36@20000', termMonths: 36, monthlyRent: { amount: 690000, currency: 'KRW' },
        deposit: { amount: 0, currency: 'KRW' }, depositState: 'ZERO', mileageLimitKmPerYear: 20000 },
    ] }],
  }],
  meta: { schemaVersion: '1.0.0', releaseId: 'rel-1', manifestId: 'manifest-1', revision: 9,
    inputDigest: 'a', dataDigest: 'b', generatedAt: '2026-09-21T00:00:00.000Z', activatedAt: '2026-09-21T00:01:00.000Z' },
};

describe('FreePass Data Catalog V1', () => {
  it('버전·릴리스 증거를 검증하고 같은 Offer 가격항목을 보존한다', () => {
    const release = parseCatalogV1(fixture);
    const product = toAdminProduct(release.data[0], release.meta);
    assert.equal(product.sourceSnapshotId, 'rel-1');
    assert.equal(product.version, 7);
    assert.equal(product.offers[0].id, 'offer-1:36@20000');
    assert.equal(product.offers[0].deposit, 0);
    assert.equal(product.offers[0].monthlyRent, 690000);
  });

  it('지원하지 않는 major 판은 HOLD로 실패한다', () => {
    assert.throws(() => parseCatalogV1({ ...fixture, meta: { ...fixture.meta, schemaVersion: '2.0.0' } }), /지원하지 않는/);
  });

  it('release 증거가 없으면 빈 성공으로 만들지 않는다', () => {
    assert.throws(() => parseCatalogV1({ ...fixture, meta: { ...fixture.meta, releaseId: '' } }), /releaseId/);
  });

  it('가격 보증금 상태와 금액이 모순이면 실패한다', () => {
    const broken = structuredClone(fixture);
    broken.data[0].offers[0].priceTerms[0].depositState = 'KNOWN';
    assert.throws(() => parseCatalogV1(broken), /데이터 검증/);
  });

  it('Admin이 표현할 수 없는 다중 공급자 상품은 조용히 합치지 않는다', () => {
    const release = parseCatalogV1({
      ...fixture,
      data: [{ ...fixture.data[0], offers: [
        fixture.data[0].offers[0],
        { ...fixture.data[0].offers[0], offerId: 'offer-2', supplierId: 'supplier-2' },
      ] }],
    });
    assert.throws(() => toAdminProduct(release.data[0], release.meta), /공급사 하나만/);
  });
});
