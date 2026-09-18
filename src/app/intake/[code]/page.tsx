import { redirect } from 'next/navigation';

/**
 * 옛 주소 — 접수 상세는 이제 계약접수 쪽 «오른쪽 판»에서 연다(대표 절대 법칙: 위 메뉴 말고는 쪽을 안 옮긴다).
 * 들어오면 `?ic=<코드>` 로 넘긴다. 진행 체크 부품(Progress)은 이 폴더에 그대로 있다 — 판(intake/panels)이 쓴다.
 */
export default async function IntakeDetailRedirect({ params, searchParams }: {
  params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const q = await searchParams;
  const u = new URLSearchParams({ ic: decodeURIComponent(code) });
  if (q.created) u.set('created', '1');
  if (q.exists) u.set('exists', '1');
  redirect(`/intake?${u}`);
}
