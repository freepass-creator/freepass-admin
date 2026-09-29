import { ProductsBoard } from './board';

export const dynamic = 'force-dynamic';

/**
 * 상품찾기 — 계약접수와 동일한 목록/상세 패널을 그대로 쓴다.
 * `mode="find"`에서 목록 패널의 폭만 2배가 되고, 패널 내부 구조와 상품상세는 /intake와 같다.
 */
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  return <ProductsBoard q={q} mode="find" />;
}
