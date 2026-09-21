import { redirect } from 'next/navigation';

/**
 * 옛 주소 — 상품 상세는 이제 상품찾기 쪽 «상세 판»에서 본다(대표 절대 법칙: 위 메뉴 말고는 쪽을 안 옮긴다).
 * 들어오면 그 차를 고른 상품찾기로 넘긴다. 상세정보(차량·정책 전부)는 판 안의 「상세정보」 탭에 있다.
 */
export default async function ProductDetailRedirect({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const u = new URLSearchParams({ id: decodeURIComponent(id), v: 'detail' });
  if (one(q.offer)) u.set('offer', one(q.offer));
  redirect(`/products?${u}`);
}
