import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanonicalProduct } from '../domain/product/types';
import { productByIdFresh, products } from './erp5';

test('접수 저장용 상품 조회는 목록 캐시를 거치지 않고 ERP5 단건 정본을 읽는다', async (t) => {
  const originalGet = products.get;
  const originalList = products.list;
  const fresh = { id: 'product-fresh' } as CanonicalProduct;

  products.get = async (id: string) => {
    assert.equal(id, 'product-fresh');
    return fresh;
  };
  products.list = async () => {
    throw new Error('mutation 검증에서 목록/캐시 경로를 사용하면 안 된다');
  };

  t.after(() => {
    products.get = originalGet;
    products.list = originalList;
  });

  const result = await productByIdFresh('product-fresh');
  assert.equal(result, fresh);
});
