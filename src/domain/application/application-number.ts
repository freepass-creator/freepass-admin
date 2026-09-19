/**
 * 접수번호 — `A-YYMMDD-NNN`.
 *
 * ★사람이 «전화로 읽어 주는» 번호다. 그래서 날짜가 들어간다 — 「구일육 십오번」이면
 *   어느 날 건인지 바로 통한다. UUID 는 저장소의 열쇠지 사람의 번호가 아니다.
 * ★`id` 와는 다른 것이다. `id` 는 기계가 쓰고, 이 번호는 사람이 쓴다.
 */
export function datePrefix(now: Date): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `A-${yy}${mm}${dd}-`;
}

export function applicationNumber(prefix: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error('Application sequence must be a positive integer.');
  return `${prefix}${String(sequence).padStart(3, '0')}`;
}
