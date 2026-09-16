import type { CanonicalProduct, Offer, PolicyValue } from './types';

/**
 * S-10 — 적용 정책 = 상품 정책 위에 Offer 정책을 덮은 것.
 * 같은 `policyId` 면 Offer 가 이긴다.
 *
 * 검색 · 상세 · 접수 Snapshot 이 **이 함수 하나**를 쓴다.
 * 두 곳에서 따로 해석하면 화면에 보이던 조건과 접수된 조건이 갈린다.
 */
export function resolveOfferPolicies(
  product: Pick<CanonicalProduct, 'productPolicies'>,
  offer: Pick<Offer, 'policyValues'>,
): PolicyValue[] {
  const byId = new Map<string, PolicyValue>();
  for (const policy of product.productPolicies) byId.set(policy.policyId, policy);
  for (const policy of offer.policyValues) byId.set(policy.policyId, policy);
  return [...byId.values()];
}
