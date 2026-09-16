import type { CanonicalProduct } from '../product/types';
import { matchProduct } from './match-product';
import type { ProductSearchMatch, ProductSearchQuery } from './types';

/**
 * S-12 — EXACT 가 PARTIAL 보다 먼저. 같은 등급 안에서는 **입력 순서를 유지**한다.
 * 가격·인기·최신 정렬은 `DECISION REQUIRED` — 정하기 전에는 넣지 않는다.
 */
export function searchProducts(
  products: readonly CanonicalProduct[],
  query: ProductSearchQuery,
): ProductSearchMatch[] {
  const exact: ProductSearchMatch[] = [];
  const partial: ProductSearchMatch[] = [];

  for (const product of products) {
    const match = matchProduct(product, query);
    if (!match) continue;
    (match.vehicleMatch.level === 'EXACT' ? exact : partial).push(match);
  }

  return [...exact, ...partial];
}
