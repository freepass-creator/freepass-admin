import type { Performance } from '../domain/performance/types';
import type { SettlementCalculation } from '../domain/settlement/types';

/**
 * 수수료 계산 정본의 문.
 * 과도기에는 freepasserp4/F04 규칙 Adapter가 붙을 수 있지만,
 * 최종적으로는 FreePass Admin/FreePass Data가 이 계약의 정본 구현을 가진다.
 */
export interface SettlementRuleProvider {
  quote(performance: Performance): Promise<SettlementCalculation>;
}
