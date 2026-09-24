import { redirect } from 'next/navigation';

/**
 * Legacy standalone intake-list route.
 * Intake list/status/search now live in the canonical /intake workspace — PC 는 3패널의 세 번째
 * 판(wiq/wiv), 폰은 ProductWorkspace 자신의 iq/iv — 이니 status 결정이 두 화면에 나뉘지 않는다.
 * 같은 주소가 둘 다 맞아야 해서 두 이름 다 싣는다.
 */
export default async function IntakeListRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const u = new URLSearchParams({ v: 'work' });

  const text = one(q.q).trim();
  const month = one(q.month).trim();
  const legacyView = one(q.view).trim();

  if (text) { u.set('iq', text); u.set('wiq', text); }
  if (month) u.set('im', month);
  if (legacyView === 'cancelled') { u.set('iv', '취소'); u.set('wiv', '취소'); }
  else if (legacyView === 'all') { u.set('iv', 'all'); u.set('wiv', 'all'); }

  redirect(`/intake?${u}`);
}
