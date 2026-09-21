import type { Axis } from '../../domain/settlement/lifecycle';
import type { SettlementRow } from '../../domain/settlement/types';

export type SettlementPrimaryAction = 'none' | 'confirm' | 'uncorrect' | 'invoice' | 'cash' | 'done';

export function settlementPrimaryAction(
  row: Pick<SettlementRow, 'claimStage' | 'payStage'> & {
    progress: Pick<SettlementRow['progress'], 'invoiceIssued'>;
  },
  axis: Axis,
): SettlementPrimaryAction {
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
