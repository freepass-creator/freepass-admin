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


/** 같은 거래처 묶음에서 아직 끝나지 않은 다음 업무 줄. 상태를 바꾸지 않고 이동만 줄인다. */
export function nextActionablePerformanceCode(
  lines: readonly LedgerLine[],
  axis: PerformanceAxis,
  currentCode: string,
  text = '',
): string | null {
  const q = text.trim().toLowerCase();
  const queue = lines.filter((line) => !performanceDone(line, axis)
    && (!q || performanceSearchText(line).includes(q)));
  if (!queue.length) return null;
  const i = queue.findIndex((line) => line.row.id === currentCode);
  if (i < 0) return queue[0].row.id;
  return queue[i + 1]?.row.id ?? queue.find((line) => line.row.id !== currentCode)?.row.id ?? null;
}
