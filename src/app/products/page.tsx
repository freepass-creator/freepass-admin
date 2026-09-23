import { ProductWorkspace } from './workspace';
import { ProductsScreen } from '../_erp/ProductsScreen';

export const dynamic = 'force-dynamic';

/** 상품찾기 — 찾고 상세 보는 데 특화. 상품 목록(판 두 개 폭) + 상품 상세. (대표 2026-09-18) */
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  /* PC = ERP 표준 화면(DEC-2026-09-23-01), 폰 = 기존 판 — CSS(_erp/shell.css)가 폭으로 가른다 */
  return <><ProductsScreen q={q} /><ProductWorkspace q={q} mode="find" base="/products" /></>;
}
