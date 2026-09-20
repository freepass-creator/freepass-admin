import { AppError } from '../errors';

/** 실적번호 — P-YYMMDD-NNN. 접수번호와 기계 id를 섞지 않는다. */
export function performanceDatePrefix(now: Date): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `P-${yy}${mm}${dd}-`;
}

export function performanceNumber(prefix: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new AppError('VALIDATION', 'Performance sequence must be a positive integer.');
  }
  return `${prefix}${String(sequence).padStart(3, '0')}`;
}
