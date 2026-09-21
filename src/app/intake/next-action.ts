import type { Block } from '../../domain/settlement/types';

export type IntakeNextAction =
  | { kind: 'new' }
  | { kind: 'paper' }
  | { kind: 'plate' }
  | { kind: 'delivered' }
  | { kind: 'settlement'; tab: 'claim' | 'pay' }
  | { kind: 'blocked'; label: Block };

const PAY_BLOCKS: Block[] = ['지급금액 모름', '지급'];
const CLAIM_BLOCKS: Block[] = ['청구금액 모름', '청구', '계산서', '수금'];

export function intakeNextAction(block: Block | null, cancelled: boolean, delivered: boolean): IntakeNextAction {
  if (cancelled || !block) return { kind: 'new' };
  if (block === '계약서') return { kind: 'paper' };
  if (block === '차량번호 없음') return { kind: 'plate' };
  if (block === '인도') return { kind: 'delivered' };
  if (delivered && PAY_BLOCKS.includes(block)) return { kind: 'settlement', tab: 'pay' };
  if (delivered && CLAIM_BLOCKS.includes(block)) return { kind: 'settlement', tab: 'claim' };
  return { kind: 'blocked', label: block };
}
