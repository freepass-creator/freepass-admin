import type { Axis } from '../../domain/settlement/lifecycle';
import type { SettlementRow } from '../../domain/settlement/types';
import { workflowConsistencyIssues } from '../../domain/settlement/consistency';

export type SettlementPrimaryAction = 'none' | 'confirm' | 'uncorrect' | 'invoice' | 'cash' | 'done';

export function settlementPrimaryAction(row: SettlementRow, axis: Axis): SettlementPrimaryAction {
  // UI 라벨은 U가 정한다. F는 모순 row에서 어떤 진행 액션도 열지 않는다.
  if (workflowConsistencyIssues(row).length > 0) return 'none';
  const stage = axis === '공급사' ? row.claimStage : row.payStage;
  if (stage === '접수') return 'none';
  if (stage === '청구' || stage === '통보') return 'confirm';
  if (stage === '정정') return 'uncorrect';
  if (stage === '확인') {
    if (axis === '공급사' && !row.progress.invoiceIssued) return 'invoice';
    return 'cash';
  }
  if (stage === '수금' || stage === '지급') return 'done';
  return 'none';
}
