import type { SettlementRow } from './types';

/**
 * 정산 업무에 들어갈 수 있는 최소 관측 사실.
 * 화면/목록뿐 아니라 mutation도 같은 gate를 사용한다.
 */
export function settlementEligible(r: Pick<SettlementRow, 'plate' | 'progress'>): boolean {
  return !r.progress.cancelled
    && !r.progress.settleExclude
    && !!r.plate
    && r.progress.paper
    && r.progress.delivered
    && /^\d{4}-\d{2}-\d{2}$/.test(String(r.progress.deliveredAt ?? ''));
}
