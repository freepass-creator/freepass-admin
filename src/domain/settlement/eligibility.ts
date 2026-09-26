import type { SettlementRow } from './types';
import { isCalendarDay } from './calendar';

/**
 * 정산 업무에 들어갈 수 있는 최소 관측 사실.
 * 화면/목록뿐 아니라 mutation도 같은 gate를 사용한다.
 */
export function settlementEligible(r: Pick<SettlementRow, 'plate' | 'progress' | 'contractCancelledAt'>): boolean {
  return !r.contractCancelledAt
    && !r.progress.cancelled
    && !r.progress.settleExclude
    && !!r.plate
    && r.progress.paper
    && r.progress.delivered
    && isCalendarDay(r.progress.deliveredAt);
}
