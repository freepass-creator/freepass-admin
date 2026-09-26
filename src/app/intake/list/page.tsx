import { redirect } from 'next/navigation';

/**
 * Legacy standalone intake-list route.
 * Intake list/status/search now live in the canonical /intake workspace so
 * status decisions are not duplicated across two screens.
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
