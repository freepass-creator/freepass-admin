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


const DAY_MS = 24 * 60 * 60 * 1000;

const dayStamp = (value: string | null | undefined): number | null => {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  const stamp = Date.UTC(y, month - 1, d);
  const check = new Date(stamp);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== d) return null;
  return stamp;
};

/** Calendar-day age of an intake, used only as an operational cue. */
export function intakeAgeDays(row: SettlementRow, asOf: string): number | null {
  const start = dayStamp(row.receivedAt);
  const end = dayStamp(asOf);
  if (start === null || end === null) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}
