import type { LedgerLine } from './ledgers';

export type PerformanceAxis = '공급사' | '영업채널';
export type PerformanceFilterMode = 'all' | 'todo' | 'issue' | 'done';

export function performanceDone(line: LedgerLine, axis: PerformanceAxis): boolean {
  return axis === '공급사' ? line.row.progress.collected : line.row.progress.paid;
}

export function performanceIssue(line: LedgerLine, axis: PerformanceAxis): boolean {
  const stage = axis === '공급사' ? line.row.claimStage : line.row.payStage;
  return line.broken || (axis === '공급사' && line.row.progress.billHold) || stage === '정정';
}

export function performanceMatchesMode(line: LedgerLine, axis: PerformanceAxis, mode: PerformanceFilterMode): boolean {
  if (mode === 'all') return true;
  const done = performanceDone(line, axis);
  const issue = !done && performanceIssue(line, axis);
  if (mode === 'done') return done;
  if (mode === 'issue') return issue;
  return !done && !issue;
}

export function performanceSearchText(line: LedgerLine): string {
  const r = line.row;
  return [r.customer, r.plate, r.model, r.supplier, r.channel, r.agent, r.id]
    .filter(Boolean).join(' ').toLowerCase();
}

export function filterPerformanceLines(
  lines: readonly LedgerLine[],
  axis: PerformanceAxis,
  mode: PerformanceFilterMode,
  text = '',
): LedgerLine[] {
  const q = text.trim().toLowerCase();
  return lines.filter((line) =>
    performanceMatchesMode(line, axis, mode)
    && (!q || performanceSearchText(line).includes(q)));
}
