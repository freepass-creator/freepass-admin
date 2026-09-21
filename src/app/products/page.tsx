import { ProductWorkspace } from './workspace';

export const dynamic = 'force-dynamic';

/** 상품찾기 — 찾고 상세 보는 데 특화. 상품 목록(판 두 개 폭) + 상품 상세. (대표 2026-09-18) */
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ProductWorkspace q={await searchParams} mode="find" base="/products" />;
}
