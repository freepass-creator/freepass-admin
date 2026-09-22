import { PerformanceBoard } from './board';

export const dynamic = 'force-dynamic';

/** 실적관리 — 목업 판(실적 목록 | 실적 상세 | 대조 업무). 대표 2026-09-22 「목업대로 나눔」 */
export default async function PerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PerformanceBoard q={await searchParams} />;
}
