export type ProgressFormKind = 'plate' | 'paper' | 'delivered' | 'cancelled';

export function progressFormId(code: string, kind: ProgressFormKind): string {
  const safe = code.replace(/[^A-Za-z0-9_-]/g, '_');
  return `intake-progress-${kind}-${safe}`;
}
