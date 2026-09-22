import { ProductsBoard } from './board';

export const dynamic = 'force-dynamic';

/** 상품찾기 — 목업 판(상품목록 | 상품상세 | 신규 계약접수). 대표 2026-09-22 「판갈이」 */
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ProductsBoard q={await searchParams} />;
}
