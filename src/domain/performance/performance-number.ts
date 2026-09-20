export function performanceNumber(datePrefix: string, sequence: number): string {
  return `P-${datePrefix}-${String(sequence).padStart(3, '0')}`;
}
