import { redirect } from 'next/navigation';
import { sp } from '../_fn/fmt';
import { SettlementBoard } from './board';

export const dynamic = 'force-dynamic';

/**
 * 정산관리 — 목업 판(정산 목록 | 정산 상세 | 정산 업무). 대표 2026-09-22 「목업대로 나눔」
 *   묶음(거래처 × 달)의 발행 · 청구 링크는 여기. 건 하나의 확인 · 정정 · 계산서 · 수금/지급은 /performance(실적).
 *   ⓘ 옛 주소 `?focus=<접수코드>&tab=` (접수 → 정산 handoff) 는 그 건의 실적 대조로 넘긴다 — 못 서면 거기서 접수로 되돌린다.
 */
export default async function SettlementPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const focus = sp(q.focus).trim();
  if (focus) redirect(`/performance?ic=${encodeURIComponent(focus)}&ax=${sp(q.tab) === 'pay' ? 'pay' : 'claim'}`);
  return <SettlementBoard q={q} />;
}
