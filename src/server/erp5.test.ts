import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanonicalProduct } from '../domain/product/types';
import { legacyProducts, productByIdFresh } from './freepass-data';

test('접수 저장용 상품 조회는 목록 캐시를 거치지 않고 FreePass Data Catalog 경계를 fresh read 한다', async (t) => {
  const originalGet = legacyProducts.get;
  const originalList = legacyProducts.list;
  const originalMode = process.env.FREEPASS_DATA_ADMIN_CATALOG_READ_MODE;
  const fresh = { id: 'product-fresh' } as CanonicalProduct;
  process.env.FREEPASS_DATA_ADMIN_CATALOG_READ_MODE = 'OBSERVE';

  legacyProducts.get = async (id: string) => {
    assert.equal(id, 'product-fresh');
    return fresh;
  };
  legacyProducts.list = async () => {
    throw new Error('mutation 검증에서 목록/캐시 경로를 사용하면 안 된다');
  };

  t.after(() => {
    legacyProducts.get = originalGet;
    legacyProducts.list = originalList;
    if (originalMode === undefined) delete process.env.FREEPASS_DATA_ADMIN_CATALOG_READ_MODE;
    else process.env.FREEPASS_DATA_ADMIN_CATALOG_READ_MODE = originalMode;
  });

  const result = await productByIdFresh('product-fresh');
  assert.equal(result, fresh);
});
