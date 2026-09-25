export const SUBMIT_CLAIM_TTL = 90_000;
export const FINALIZE_CLAIM_TTL = 90_000;

export function claimIsFresh(at: unknown, now: number, ttl: number): boolean {
  const started=Number(at??0);
  return Number.isFinite(started) && started > 0 && started > now - ttl;
}
