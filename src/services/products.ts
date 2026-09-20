import { searchProducts } from '../domain/search/search-products';
import type { ProductSearchMatch, ProductSearchQuery } from '../domain/search/types';
import type { ProductRepository } from '../ports/repositories';

/** 실제 관리자 상품찾기 서비스. 화면은 하드코딩 배열 대신 이 경로를 사용한다. */
export async function findProducts(
  products: ProductRepository,
  query: ProductSearchQuery,
): Promise<ProductSearchMatch[]> {
  return searchProducts(await products.list(), query);
}
