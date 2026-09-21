import type { Bucket } from './stage';
import type { SettlementRow } from './types';

export type IntakeListView = Bucket | 'all';

/**
 * Intake work ordering.
 * - 미완료: oldest first. A stalled case becomes more urgent as it ages.
 * - every other view: newest first, matching normal intake/performance work.
 * Stable id ordering makes equal-date results deterministic.
 */
export function sortIntakeRows(rows: SettlementRow[], view: IntakeListView): SettlementRow[] {
  const oldestFirst = view === '미완료';
  return [...rows].sort((a, b) => {
    const ad = String(a.receivedAt ?? '');
    const bd = String(b.receivedAt ?? '');
    const byDate = ad.localeCompare(bd);
    if (byDate !== 0) return oldestFirst ? byDate : -byDate;
    return a.id.localeCompare(b.id);
  });
}
