import type { Axis } from '../../domain/settlement/lifecycle';
import type { SettlementRow } from '../../domain/settlement/types';
import { workflowConsistencyIssues } from '../../domain/settlement/consistency';

export type SettlementPrimaryAction = 'none' | 'confirm' | 'uncorrect' | 'invoice' | 'cash' | 'done' | 'data-check';

export function settlementPrimaryAction(row: SettlementRow, axis: Axis): SettlementPrimaryAction {
  if (workflowConsistencyIssues(row).length > 0) return 'data-check';
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
