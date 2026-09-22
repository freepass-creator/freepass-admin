import { ProductsBoard } from '../products/board';

export const dynamic = 'force-dynamic';

/**
 * 계약접수 — **메인**. 판 셋: 상품 목록 | 상품 상세 | 접수(목록 → 상세 · [접수하기] = 신규 계약접수).
 *   대표 2026-09-18 「이게 우리 메인」 · 2026-09-22 「접수는 상품 찾아서 선택해서 상세페이지 보고 접수하는 거」.
 *   상품찾기(/products)는 상품만 — 판 둘(목록 | 상세), [접수하기]가 여기로 넘어온다.
 */
export default async function IntakeMain({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ProductsBoard q={await searchParams} mode="intake" />;
}
