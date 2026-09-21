import { redirect } from 'next/navigation';

/**
 * 옛 주소 — 신규 접수는 이제 계약접수 쪽 «오른쪽 판»에서 한다(대표 절대 법칙: 위 메뉴 말고는 쪽을 안 옮긴다).
 * 들어오면 같은 뜻의 판 주소로 넘긴다. 폼 부품(IntakeForm)은 이 폴더에 그대로 있다 — 판(intake/panels)이 쓴다.
 */
export default async function NewIntakeRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const u = new URLSearchParams({ w: 'new' });
  if (one(q.product)) u.set('product', one(q.product));
  if (one(q.offer)) u.set('offer', one(q.offer));
  redirect(`/intake?${u}`);
}
